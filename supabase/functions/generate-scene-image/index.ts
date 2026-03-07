import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Image gen error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Image generation failed");
    }

    const data = await response.json();
    
    // The gateway returns image data in the response
    const message = data.choices?.[0]?.message;
    
    // Check for inline image data in parts (multimodal response)
    if (message?.content) {
      // If content is an array (multimodal), find image part
      if (Array.isArray(message.content)) {
        const imagePart = message.content.find((p: any) => p.type === "image_url" || p.inline_data);
        if (imagePart?.image_url?.url) {
          return new Response(JSON.stringify({ imageUrl: imagePart.image_url.url }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (imagePart?.inline_data) {
          const imageUrl = `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
          return new Response(JSON.stringify({ imageUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      
      // If content is a string, it might contain a data URL or base64
      if (typeof message.content === "string" && message.content.startsWith("data:")) {
        return new Response(JSON.stringify({ imageUrl: message.content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check for image in the raw response structure (Gemini native format passed through)
    const parts = data.candidates?.[0]?.content?.parts || [];
    const inlineImagePart = parts.find((p: any) => p.inlineData);
    if (inlineImagePart?.inlineData) {
      const imageUrl = `data:${inlineImagePart.inlineData.mimeType};base64,${inlineImagePart.inlineData.data}`;
      return new Response(JSON.stringify({ imageUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("Unexpected response structure:", JSON.stringify(data).slice(0, 500));
    throw new Error("No image generated");
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
