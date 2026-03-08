import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    
    let explanation: any;
    const errors: string[] = [];

    if (LOVABLE_API_KEY) {
      try {
        explanation = await generateWithLovableAI(LOVABLE_API_KEY, question);
      } catch (e) {
        console.warn("Lovable AI failed:", e);
        errors.push(`Lovable: ${e}`);
      }
    }

    if (!explanation && GROQ_API_KEY) {
      try {
        explanation = await generateWithGroq(GROQ_API_KEY, question);
      } catch (e) {
        console.warn("Groq failed:", e);
        errors.push(`Groq: ${e}`);
      }
    }

    if (!explanation && GOOGLE_GEMINI_API_KEY) {
      try {
        explanation = await generateWithGemini(GOOGLE_GEMINI_API_KEY, question);
      } catch (e) {
        console.warn("Gemini failed:", e);
        errors.push(`Gemini: ${e}`);
      }
    }

    if (!explanation) {
      throw new Error(errors.length ? `All providers failed: ${errors.join("; ")}` : "No AI API key configured");
    }

    return new Response(JSON.stringify(explanation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limited") ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

const SCENE_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", description: "2-3 sentence scene narration explaining one concept" },
    imagePrompt: {
      type: "string",
      description: "A SINGLE, highly specific image prompt that EXACTLY depicts the concept described in the scene text. Must be a literal visual representation — like a textbook illustration of that exact concept. Example: if text says 'Chloroplasts absorb sunlight', prompt should be 'Cross-section of a chloroplast organelle showing green thylakoid membranes absorbing golden sunlight rays, detailed scientific illustration'. NO text/labels in image. Realistic educational style."
    },
  },
  required: ["text", "imagePrompt"],
  additionalProperties: false,
};

async function generateWithLovableAI(apiKey: string, question: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are an expert educational content creator. For each scene, create ONE image prompt that EXACTLY illustrates the specific concept in that scene's text — like a textbook diagram of that exact subject. Be literal and specific." },
        { role: "user", content: `Create an educational explanation for: ${question}. Each scene needs a single imagePrompt (string, not array) that is a LITERAL visual depiction of the exact concept in the scene text. Be SPECIFIC. NO abstract art. NO text/labels in images.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "create_explanation",
          description: "Create a structured educational explanation with scenes, each having multiple image prompts.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              fullAnswer: { type: "string", description: "Comprehensive 3-5 paragraph explanation, at least 200 words" },
              scenes: { type: "array", items: SCENE_SCHEMA },
            },
            required: ["title", "fullAnswer", "scenes"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "create_explanation" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Lovable AI error:", response.status, errText);
    throw new Error(response.status === 429 ? "Rate limited" : response.status === 402 ? "Credits exhausted" : "AI gateway error");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("No response from AI");
  return normalizeExplanation(JSON.parse(toolCall.function.arguments));
}

const JSON_PROMPT = `You are an expert educational content creator. Given a question, create a thorough explanation broken into scenes for an animated video, AND a written text answer.

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact structure:
{"title":"Engaging title","fullAnswer":"Comprehensive 3-5 paragraph explanation (at least 200 words)","scenes":[{"text":"2-3 sentence scene narration","imagePrompts":["First image prompt DIRECTLY depicting the exact concept in the scene text","Second image prompt showing a different visual angle of the SAME concept","Third image prompt showing a close-up or diagram of the SAME concept"]}]}

Rules:
- Create 6-8 scenes. Each scene text should be 2-3 sentences.
- Each scene MUST have an "imagePrompts" array with 2-3 prompts.
- CRITICAL: Each image prompt MUST visually depict the EXACT subject described in that scene's text. If the scene text talks about "chloroplasts absorbing light", the image should show chloroplasts absorbing light — NOT a generic plant or sun image.
- Image prompts must be SPECIFIC, LITERAL and ACCURATE — like precise textbook illustrations of the exact concept being explained.
- NO abstract art, NO text or labels in images, NO generic stock-photo style images.
- fullAnswer must be at least 200 words.`;

async function generateWithGemini(apiKey: string, question: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${JSON_PROMPT}\n\nQuestion: ${question}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini error:", response.status, errText);
    throw new Error(response.status === 429 ? "Rate limited. Please try again shortly." : "Gemini API error");
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) throw new Error("No response from Gemini");
  return normalizeExplanation(JSON.parse(textContent));
}

async function generateWithGroq(apiKey: string, question: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: `${JSON_PROMPT}\n\nQuestion: ${question}` }],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Groq error:", response.status, errText);
    throw new Error(response.status === 429 ? "Rate limited" : "Groq API error");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from Groq");
  return normalizeExplanation(JSON.parse(content));
}

// Ensure backward compatibility: if AI returns old format (imagePrompt string), convert to imagePrompts array
function normalizeExplanation(expl: any) {
  if (expl.scenes) {
    expl.scenes = expl.scenes.map((scene: any) => {
      if (!scene.imagePrompts && scene.imagePrompt) {
        scene.imagePrompts = [scene.imagePrompt];
      }
      // Also keep imagePrompt for backward compat (first one)
      if (scene.imagePrompts && !scene.imagePrompt) {
        scene.imagePrompt = scene.imagePrompts[0];
      }
      return scene;
    });
  }
  return expl;
}
