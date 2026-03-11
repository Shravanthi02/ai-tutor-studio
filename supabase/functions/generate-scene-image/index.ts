import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    let imageUrl: string | null = null;

    // Try Lovable AI first (with retry on rate limit)
    if (LOVABLE_API_KEY) {
      for (let attempt = 0; attempt < 3 && !imageUrl; attempt++) {
        try {
          if (attempt > 0) await delay(2000 * attempt);
          imageUrl = await generateWithLovableAI(LOVABLE_API_KEY, prompt);
        } catch (e: any) {
          console.warn(`Lovable AI attempt ${attempt + 1} failed:`, e.message);
          if (!e.message?.includes("429") || attempt === 2) break;
        }
      }
    }

    // Try Gemini direct API
    if (!imageUrl && GOOGLE_GEMINI_API_KEY) {
      try {
        imageUrl = await generateWithGemini(GOOGLE_GEMINI_API_KEY, prompt);
      } catch (e) {
        console.warn("Gemini image failed:", e);
      }
    }

    // Fallback: Pollinations.ai (return URL directly, no download)
    if (!imageUrl) {
      try {
        imageUrl = generatePollinationsUrl(prompt);
      } catch (e) {
        console.warn("Pollinations failed:", e);
      }
    }

    if (!imageUrl) throw new Error("All image providers failed");

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Pollinations: just return the URL directly - the browser will load it
function generatePollinationsUrl(prompt: string): string {
  // Keep prompt short to avoid 500 errors
  const shortPrompt = prompt.slice(0, 200);
  const enhancedPrompt = `Educational diagram: ${shortPrompt}, clean, bright, simple`;
  const seed = Math.floor(Math.random() * 10000000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=576&nologo=true&seed=${seed}`;
}

async function generateWithLovableAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: `Generate an educational illustration: ${prompt.slice(0, 300)}` }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Lovable AI image error:", response.status, errText);
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;

  if (Array.isArray(message?.images)) {
    const img = message.images[0];
    if (img?.image_url?.url) return img.image_url.url;
  }

  if (Array.isArray(message?.content)) {
    const imagePart = message.content.find((p: any) => p.type === "image_url" || p.inline_data);
    if (imagePart?.image_url?.url) return imagePart.image_url.url;
    if (imagePart?.inline_data) return `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
  }

  if (typeof message?.content === "string" && message.content.startsWith("data:")) {
    return message.content;
  }

  throw new Error("No image in response");
}

async function generateWithGemini(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Generate an educational illustration image: ${prompt.slice(0, 300)}` }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini image error:", response.status, errText);
    throw new Error(response.status === 429 ? "Rate limited" : "Image generation failed");
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);
  if (!imagePart?.inlineData) throw new Error("No image generated");
  return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}
