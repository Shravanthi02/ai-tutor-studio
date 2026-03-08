import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, sceneText } = await req.json();
    
    // Use sceneText as the PRIMARY visual description — it's exactly what the slide narrates
    const narration = sceneText || prompt;
    const visualPrompt = buildVisualPrompt(narration, prompt);
    
    const imageUrl = await generateWithPollinations(visualPrompt);

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

function buildVisualPrompt(narration: string, imagePrompt: string): string {
  // Keep it short and focused for Pollinations URL limits
  const short = narration.length > 100 ? narration.substring(0, 100) : narration;
  return `${short}, ${imagePrompt}, realistic educational illustration, scientifically accurate, detailed, vibrant, no text no labels no words`;
}

async function generateWithPollinations(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt).substring(0, 800);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=576&nologo=true&seed=${Date.now()}&model=flux`;
  
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
