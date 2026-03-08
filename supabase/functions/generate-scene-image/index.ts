import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, sceneText, sceneIndex } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    let imageUrl: string | null = null;

    // Try Lovable AI first
    if (!imageUrl && LOVABLE_API_KEY) {
      try { imageUrl = await generateWithLovableAI(LOVABLE_API_KEY, prompt, sceneText); }
      catch (e) { console.warn("Lovable AI image failed:", e); }
    }

    // Try Gemini
    if (!imageUrl && GOOGLE_GEMINI_API_KEY) {
      try { imageUrl = await generateWithGemini(GOOGLE_GEMINI_API_KEY, prompt, sceneText); }
      catch (e) { console.warn("Gemini image failed:", e); }
    }

    // Fallback: Pollinations (free, no key needed) — return direct URL for client to load
    if (!imageUrl) {
      try { imageUrl = generatePollinationsUrl(prompt, sceneText, sceneIndex ?? 0); }
      catch (e) { console.warn("Pollinations URL failed:", e); }
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

// Return a direct Pollinations URL — the client browser loads this directly as an <img src>
function generatePollinationsUrl(prompt: string, sceneText: string | undefined, sceneIndex: number): string {
  // Use the imagePrompt as primary (crafted for image generation)
  const imageDesc = prompt.substring(0, 350);
  const style = "realistic detailed educational textbook illustration, accurate, vibrant colors, high quality, no text no words no labels";
  const visualPrompt = `${imageDesc}, ${style}`;

  // Unique seed per scene
  const hashCode = prompt.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  const uniqueSeed = Math.abs(sceneIndex * 100000 + hashCode) % 9999999;

  const encoded = encodeURIComponent(visualPrompt);
  // Use flux-realism model for better quality and relevance
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=576&seed=${uniqueSeed}&model=flux-realism&nologo=true&enhance=true`;
  
  console.log(`Pollinations scene ${sceneIndex}: seed=${uniqueSeed}, prompt="${visualPrompt.substring(0, 100)}..."`);
  
  return url;
}

async function generateWithLovableAI(apiKey: string, prompt: string, sceneText?: string): Promise<string> {
  const instruction = sceneText 
    ? `Generate a realistic educational illustration that EXACTLY depicts: "${sceneText}". Visual details: ${prompt}. Style: detailed textbook diagram, scientifically accurate, no text or labels.` 
    : `Generate an accurate educational illustration: ${prompt}`;
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: instruction }],
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
  if (typeof message?.content === "string" && message.content.startsWith("data:")) return message.content;
  const parts = data.candidates?.[0]?.content?.parts || [];
  const inlinePart = parts.find((p: any) => p.inlineData);
  if (inlinePart?.inlineData) return `data:${inlinePart.inlineData.mimeType};base64,${inlinePart.inlineData.data}`;
  throw new Error("No image in response");
}

async function generateWithGemini(apiKey: string, prompt: string, sceneText?: string): Promise<string> {
  const instruction = sceneText 
    ? `Generate a realistic educational illustration depicting: "${sceneText}". Visual: ${prompt}` 
    : prompt;
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
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
