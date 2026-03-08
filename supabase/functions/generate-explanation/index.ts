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
    text: { type: "string", description: "2-3 sentence scene narration" },
    imagePrompts: {
      type: "array",
      items: { type: "string" },
      description: "Array of 2-3 DIFFERENT image prompts for this scene. CRITICAL: Each prompt MUST directly depict the EXACT subject matter described in the scene text — not a generic or loosely related image. The image should visually represent what is being explained in the scene text. For example, if the scene text says 'Chloroplasts contain chlorophyll which absorbs sunlight', the prompts should show: ['Cross-section diagram of a chloroplast showing thylakoid membranes and stroma, with green chlorophyll pigments highlighted', 'Sunlight rays hitting a green leaf surface being absorbed by chlorophyll molecules, close-up microscopic view', 'Comparison diagram showing chlorophyll absorbing red and blue light wavelengths while reflecting green light']. Each prompt must be a vivid, specific description of the exact concept in the scene text. NO TEXT or labels in the images. Use realistic educational illustration style."
    },
  },
  required: ["text", "imagePrompts"],
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
        { role: "system", content: "You are an expert educational content creator. For each scene, create 2-3 different image prompts that DIRECTLY and PRECISELY illustrate the EXACT concepts described in the scene text. Each image prompt must visually depict the specific subject matter mentioned in that scene — not a loosely related or generic image. The images should look like they belong in an educational textbook illustrating that exact concept." },
        { role: "user", content: `Create an educational explanation for: ${question}. CRITICAL: Each scene must have 2-3 imagePrompts (as an array). Each image prompt MUST describe a visual that DIRECTLY represents the specific concept explained in that scene's text. For example, if the text talks about 'light reactions in thylakoid membranes', the image prompt should describe 'thylakoid membranes inside a chloroplast with light energy being absorbed', NOT a generic 'plant in sunlight'. Be SPECIFIC and LITERAL. NO abstract art. NO text/labels in images.` },
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
{"title":"Engaging title","fullAnswer":"Comprehensive 3-5 paragraph explanation (at least 200 words)","scenes":[{"text":"2-3 sentence scene narration","imagePrompts":["First image prompt showing one aspect","Second image prompt showing another aspect","Third image prompt showing a detail or diagram"]}]}

Rules:
- Create 6-8 scenes. Each scene text should be 2-3 sentences.
- Each scene MUST have an "imagePrompts" array with 2-3 prompts.
- Each image prompt in the array should depict a DIFFERENT visual aspect of the scene text (e.g. overview, close-up, diagram).
- Image prompts must be LITERAL and ACCURATE — like textbook illustrations.
- NO abstract art, NO text in images.
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
