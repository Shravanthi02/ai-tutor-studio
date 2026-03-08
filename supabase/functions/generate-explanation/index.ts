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

    // Fallback chain: Lovable AI → Groq → Gemini
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
        { role: "system", content: "You are an expert educational content creator." },
        { role: "user", content: `Create an educational explanation for: ${question}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "create_explanation",
          description: "Create a structured educational explanation with scenes for an animated video.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              fullAnswer: { type: "string", description: "Comprehensive 3-5 paragraph explanation, at least 200 words" },
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "2-3 sentence scene narration" },
                    imagePrompt: { type: "string", description: "Detailed illustration description: clean modern educational illustration, vibrant colors, no text" },
                  },
                  required: ["text", "imagePrompt"],
                  additionalProperties: false,
                },
              },
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
  return JSON.parse(toolCall.function.arguments);
}

async function generateWithGemini(apiKey: string, question: string) {
  const prompt = `You are an expert educational content creator. Given a question, create a thorough, detailed explanation broken into scenes for an animated video, AND a comprehensive written text answer.

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact structure:
{"title":"Engaging title","fullAnswer":"Comprehensive 3-5 paragraph explanation (at least 200 words)","scenes":[{"text":"2-3 sentence scene narration","imagePrompt":"Detailed illustration description with: clean modern educational illustration, vibrant colors, no text in image"}]}

Rules: Create 6-8 scenes. Each scene text should be 2-3 sentences. Build concepts progressively. Use analogies and real-world examples. fullAnswer must be at least 200 words. imagePrompt must describe vivid educational illustrations.

Question: ${question}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
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
  return JSON.parse(textContent);
}

async function generateWithGroq(apiKey: string, question: string) {
  const prompt = `You are an expert educational content creator. Given a question, create a thorough, detailed explanation broken into scenes for an animated video, AND a comprehensive written text answer.

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact structure:
{"title":"Engaging title","fullAnswer":"Comprehensive 3-5 paragraph explanation (at least 200 words)","scenes":[{"text":"2-3 sentence scene narration","imagePrompt":"Detailed illustration description with: clean modern educational illustration, vibrant colors, no text in image"}]}

Rules: Create 6-8 scenes. Each scene text should be 2-3 sentences. Build concepts progressively. Use analogies and real-world examples. fullAnswer must be at least 200 words. imagePrompt must describe vivid educational illustrations.

Question: ${question}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
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
