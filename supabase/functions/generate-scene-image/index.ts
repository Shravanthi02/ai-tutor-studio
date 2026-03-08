import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, sceneText } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    let imageUrl: string | null = null;

    // Try Lovable AI
    if (!imageUrl && LOVABLE_API_KEY) {
      try {
        imageUrl = await generateWithLovableAI(LOVABLE_API_KEY, prompt, sceneText);
      } catch (e) {
        console.warn("Lovable AI image failed:", e);
      }
    }

    // Try Gemini
    if (!imageUrl && GOOGLE_GEMINI_API_KEY) {
      try {
        imageUrl = await generateWithGemini(GOOGLE_GEMINI_API_KEY, prompt, sceneText);
      } catch (e) {
        console.warn("Gemini image failed:", e);
      }
    }

    // Fallback: Pollinations.ai (free, no API key needed)
    if (!imageUrl) {
      try {
        imageUrl = await generateWithPollinations(prompt, sceneText);
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

async function generateWithPollinations(prompt: string, sceneText?: string): Promise<string> {
  const contextPrefix = sceneText ? `Illustrating the concept: "${sceneText}". ` : "";
  const enhancedPrompt = `${contextPrefix}Accurate educational textbook illustration, clean and clear, realistic rendering, scientifically accurate, well-lit, detailed, directly depicting the described concept: ${prompt}`;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=768&nologo=true&seed=${Date.now()}&model=flux`;
  
  // Verify the URL works by making a HEAD request
  const response = await fetch(url, { method: "GET", redirect: "follow" });
  if (!response.ok) {
    await response.text();
    throw new Error(`Pollinations error: ${response.status}`);
  }
  
  // Convert to base64 to avoid CORS issues in the client
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:image/jpeg;base64,${base64}`;
}

async function generateWithLovableAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
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

  const parts = data.candidates?.[0]?.content?.parts || [];
  const inlinePart = parts.find((p: any) => p.inlineData);
  if (inlinePart?.inlineData) {
    return `data:${inlinePart.inlineData.mimeType};base64,${inlinePart.inlineData.data}`;
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
        contents: [{ role: "user", parts: [{ text: prompt }] }],
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
