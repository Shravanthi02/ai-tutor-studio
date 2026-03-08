import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a colorful SVG placeholder based on the prompt
function generatePlaceholderSvg(prompt: string): string {
  const colors = [
    ["#4F46E5", "#7C3AED", "#2563EB"],
    ["#059669", "#10B981", "#34D399"],
    ["#D97706", "#F59E0B", "#FBBF24"],
    ["#DC2626", "#EF4444", "#F87171"],
    ["#7C3AED", "#A855F7", "#C084FC"],
    ["#0891B2", "#06B6D4", "#22D3EE"],
  ];
  const hash = prompt.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = colors[hash % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${palette[0]}"/>
        <stop offset="100%" style="stop-color:${palette[1]}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bg)"/>
    <circle cx="200" cy="150" r="80" fill="${palette[2]}" opacity="0.3"/>
    <circle cx="600" cy="400" r="120" fill="${palette[0]}" opacity="0.2"/>
    <rect x="300" y="200" width="200" height="200" rx="20" fill="${palette[2]}" opacity="0.15"/>
    <text x="400" y="320" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" opacity="0.7">Image generating...</text>
  </svg>`;

  const base64 = btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    let imageUrl: string | null = null;

    // Try Lovable AI
    if (!imageUrl && LOVABLE_API_KEY) {
      try {
        imageUrl = await generateWithLovableAI(LOVABLE_API_KEY, prompt);
      } catch (e) {
        console.warn("Lovable AI image failed:", e);
      }
    }

    // Try Gemini
    if (!imageUrl && GOOGLE_GEMINI_API_KEY) {
      try {
        imageUrl = await generateWithGemini(GOOGLE_GEMINI_API_KEY, prompt);
      } catch (e) {
        console.warn("Gemini image failed:", e);
      }
    }

    // Fallback to SVG placeholder
    if (!imageUrl) {
      console.log("All image providers exhausted, using placeholder");
      imageUrl = generatePlaceholderSvg(prompt);
    }

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

  // Check for images array (new format)
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
