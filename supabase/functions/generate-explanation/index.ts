import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a world-class science educator who explains complex topics like a storyteller. Your explanations are:

1. **Crystal clear**: Use simple everyday language. Avoid jargon — when you must use a technical term, immediately define it with a relatable analogy.
2. **Visual & vivid**: Every sentence should paint a picture in the reader's mind. Use concrete imagery, comparisons to familiar objects, and sensory details.
3. **Progressive**: Start from what the learner already knows, then build step-by-step to deeper understanding. Each scene should feel like a natural "next chapter."
4. **Engaging**: Use "you" language, rhetorical questions, and "imagine this" scenarios to pull the reader in.
5. **Accurate**: Never sacrifice scientific accuracy for simplicity.

For image prompts: Create prompts that produce STUNNING, photorealistic or beautifully illustrated educational visuals. Think National Geographic quality meets textbook clarity. Each image should be a single, powerful visual that captures the essence of that scene — not a cluttered diagram.`;

const USER_PROMPT_TEMPLATE = (question: string) => `Create an educational video explanation for: "${question}"

SCENE TEXT RULES:
- Write exactly 6-8 scenes
- Each scene: 2-3 sentences maximum
- Use vivid analogies (e.g., "Think of DNA like a twisted ladder" or "Electrons orbit like planets around a sun")
- Start simple, build complexity gradually
- Each scene should teach ONE clear concept
- Use "Imagine..." or "Think of..." to make it visual

IMAGE PROMPT RULES:
- Each imagePrompt must create a BEAUTIFUL, clear, photorealistic or high-quality illustrated scene
- Be extremely specific: describe lighting, angle, colors, composition
- Style: "cinematic educational illustration, soft volumetric lighting, 4K quality, clean composition"
- Show ONE clear subject per image — no cluttered diagrams
- Examples of GOOD prompts:
  "A single green leaf in bright sunlight, with golden light rays visibly entering the leaf surface, tiny glowing green chloroplasts visible inside, photorealistic macro photography, soft bokeh background, warm natural lighting"
  "Cross-section of planet Earth floating in space, glowing orange magma core visible, tectonic plates shown as puzzle pieces on the surface, dramatic cinematic lighting, educational 3D render"

FULL ANSWER RULES:
- 3-5 paragraphs, at least 250 words
- Written as a standalone mini-article
- Include real-world examples and applications
- End with a "why this matters" conclusion`;

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
        { role: "user", content: USER_PROMPT_TEMPLATE(question) },
      ],
      tools: [{
        type: "function",
        function: {
          name: "create_explanation",
          description: "Create a structured educational explanation with scenes for an animated video.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "A catchy, curiosity-sparking title (5-10 words)" },
              fullAnswer: { type: "string", description: "Comprehensive 3-5 paragraph explanation, at least 250 words, written as an engaging mini-article" },
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "2-3 sentence scene narration using vivid analogies and simple language" },
                    imagePrompt: { type: "string", description: "Detailed prompt for a stunning educational visual. Include: subject, composition, lighting (soft volumetric/cinematic/warm natural), style (photorealistic/3D render/illustration), colors, and camera angle. Must show ONE clear subject. End with: high quality, clean composition, no text no labels no words" },
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
  const prompt = `${SYSTEM_PROMPT}

${USER_PROMPT_TEMPLATE(question)}

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact structure:
{"title":"Catchy title","fullAnswer":"Comprehensive mini-article (250+ words)","scenes":[{"text":"2-3 sentence narration","imagePrompt":"Detailed visual prompt with lighting, style, composition details, ending with: high quality, clean composition, no text no labels"}]}`;

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
  const prompt = `${SYSTEM_PROMPT}

${USER_PROMPT_TEMPLATE(question)}

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact structure:
{"title":"Catchy title","fullAnswer":"Comprehensive mini-article (250+ words)","scenes":[{"text":"2-3 sentence narration","imagePrompt":"Detailed visual prompt with lighting, style, composition details, ending with: high quality, clean composition, no text no labels"}]}`;

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
