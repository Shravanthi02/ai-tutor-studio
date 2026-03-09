import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an AI cinematic explainer video generator. Your task is to convert a user's question into a visually rich animated explainer video structure.

The output will power: Ken Burns animated images, cinematic scene transitions, text overlays, multiple visuals per scene, browser Text-To-Speech narration, and a detailed written explanation.

VIDEO STYLE: Modern educational documentary with dark slate background, amber gold accents, minimal modern UI, cinematic lighting, clean educational illustration style, high clarity visuals.

STORYTELLING FLOW:
Scene 1 — Curiosity Hook: Introduce the question in an intriguing way
Scene 2 — Simple Explanation: Explain using simple language
Scene 3 — How It Works: Explain the mechanism
Scene 4 — Analogy: Use a real-world comparison
Scene 5 — Summary: Wrap up clearly

VISUAL PROMPT RULES:
- Each scene needs exactly 1 image prompt
- Include cinematic lighting, wide composition, scientific/educational illustration
- End each prompt with: "high quality, clean composition, no text no labels no words"
- Include cinematic lighting, wide composition, scientific/educational illustration
- Minimal background clutter, dramatic depth, clear focal subject
- End each prompt with: "high quality, clean composition, no text no labels no words"

NARRATION RULES:
- Write natural spoken versions of the text
- Use "Imagine..." or "Think of..." to make it engaging
- Keep it conversational and clear

ANIMATION OPTIONS: slow zoom in, zoom out reveal, pan left to right, parallax movement, slow tilt upward
TRANSITION OPTIONS: fade, cross dissolve, cinematic zoom, slide transition, parallax reveal`;

const toolSchema = {
  type: "function" as const,
  function: {
    name: "create_cinematic_explanation",
    description: "Create a cinematic explainer video structure with multiple visuals per scene.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "A catchy, curiosity-sparking title (5-10 words)" },
        full_explanation: { type: "string", description: "Comprehensive written explanation, 5-7 paragraphs, 500+ words, beginner-friendly with detailed examples, real-world applications, and multiple analogies" },
        scenes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              scene_number: { type: "number" },
              title: { type: "string", description: "Short scene title" },
              hook: { type: "string", description: "Short attention-grabbing sentence" },
              text: { type: "string", description: "2-3 sentences explanation" },
              narration: { type: "string", description: "Natural spoken version for TTS" },
              visuals: {
                type: "array",
                items: { type: "string" },
                description: "Exactly 1 cinematic image prompt with lighting, composition, style details. End with: high quality, clean composition, no text no labels no words",
                minItems: 1,
                maxItems: 1
              },
              animation: { type: "string", description: "Camera animation: slow zoom in, zoom out reveal, pan left to right, parallax movement, slow tilt upward" },
              transition: { type: "string", description: "Transition to next scene: fade, cross dissolve, cinematic zoom, slide transition, parallax reveal" },
            },
            required: ["scene_number", "title", "hook", "text", "narration", "visuals", "animation", "transition"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "full_explanation", "scenes"],
      additionalProperties: false,
    },
  },
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

    // Normalize the response
    const normalized = normalizeResponse(explanation);

    return new Response(JSON.stringify(normalized), {
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

function normalizeResponse(data: any) {
  return {
    title: data.title || "Explanation",
    fullAnswer: data.full_explanation || data.fullAnswer || "",
    scenes: (data.scenes || []).map((s: any, i: number) => ({
      scene_number: s.scene_number || i + 1,
      title: s.title || `Scene ${i + 1}`,
      hook: s.hook || "",
      text: s.text || "",
      narration: s.narration || s.text || "",
      visuals: s.visuals || (s.imagePrompt ? [s.imagePrompt] : []),
      animation: s.animation || "slow zoom in",
      transition: s.transition || "fade",
    })),
  };
}

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
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Generate the cinematic animated explainer video structure for: "${question}"` },
      ],
      tools: [toolSchema],
      tool_choice: { type: "function", function: { name: "create_cinematic_explanation" } },
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
  return JSON.parse(toolCall.function.arguments);
}

async function generateWithGemini(apiKey: string, question: string) {
  const jsonPrompt = `${SYSTEM_PROMPT}

Generate the cinematic animated explainer video structure for: "${question}"

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact structure:
{"title":"","full_explanation":"","scenes":[{"scene_number":1,"title":"","hook":"","text":"","narration":"","visuals":["prompt1","prompt2","prompt3"],"animation":"slow zoom in","transition":"fade"}]}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: jsonPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini error:", response.status, errText);
    throw new Error(response.status === 429 ? "Rate limited" : "Gemini API error");
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) throw new Error("No response from Gemini");
  return JSON.parse(textContent);
}

async function generateWithGroq(apiKey: string, question: string) {
  const jsonPrompt = `${SYSTEM_PROMPT}

Generate the cinematic animated explainer video structure for: "${question}"

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact structure:
{"title":"","full_explanation":"","scenes":[{"scene_number":1,"title":"","hook":"","text":"","narration":"","visuals":["prompt1","prompt2","prompt3"],"animation":"slow zoom in","transition":"fade"}]}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: jsonPrompt }],
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
  return JSON.parse(content);
}
