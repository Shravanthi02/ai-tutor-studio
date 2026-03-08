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

    // Fallback: Pollinations.ai (free, no API key)
    if (!imageUrl) {
      try {
        imageUrl = await generateWithPollinations(prompt, sceneText, sceneIndex ?? 0);
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

async function generateWithPollinations(prompt: string, sceneText: string | undefined, sceneIndex: number): Promise<string> {
  // Use sceneText as the PRIMARY description — it's exactly what the slide narrates
  // Keep prompt short and specific to avoid URL truncation
  let visualPrompt: string;
  if (sceneText) {
    // Extract the core concept from the narration (first 80 chars) and combine with the image prompt
    const coreNarration = sceneText.substring(0, 80);
    visualPrompt = `${coreNarration}. ${prompt}. realistic educational diagram, scientifically accurate, detailed, vibrant colors, no text no words no labels`;
  } else {
    visualPrompt = `${prompt}, realistic educational illustration, detailed, no text no words`;
  }

  // Use sceneIndex + random component for unique seed per scene
  const uniqueSeed = sceneIndex * 100000 + Math.floor(Math.random() * 99999);
  const encoded = encodeURIComponent(visualPrompt).substring(0, 800);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=576&nologo=true&seed=${uniqueSeed}&model=flux`;
  
  console.log(`Pollinations request for scene ${sceneIndex}: seed=${uniqueSeed}, prompt="${visualPrompt.substring(0, 100)}..."`);
  
  const response = await fetch(url, { method: "GET", redirect: "follow" });
  if (!response.ok) throw new Error(`Pollinations error: ${response.status}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

async function generateWithLovableAI(apiKey: string, prompt: string, sceneText?: string): Promise<string> {
  const contextInstruction = sceneText 
    ? `You are generating an educational illustration. The scene being explained is: "${sceneText}". Generate an image that DIRECTLY and ACCURATELY represents this concept visually. The specific visual to create: ${prompt}` 
    : `Generate an accurate educational illustration: ${prompt}`;
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: contextInstruction }],
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
  const contextInstruction = sceneText 
    ? `Generate an educational illustration for this concept: "${sceneText}". Specific visual: ${prompt}` 
    : prompt;
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: contextInstruction }] }],
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
