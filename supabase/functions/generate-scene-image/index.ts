import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, sceneText } = await req.json();

    // Use sceneText as primary description — it's exactly what the slide narrates
    const narration = sceneText || prompt;
    
    // Build a concise, visual prompt from the narration
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

// Build a focused visual prompt from narration text
function buildVisualPrompt(narration: string, imagePrompt: string): string {
  // Extract key visual concepts from the narration (first 120 chars to avoid URL limits)
  const shortNarration = narration.length > 120 ? narration.substring(0, 120) : narration;
  
  return `${shortNarration}, ${imagePrompt}, realistic educational illustration, detailed scientific diagram style, vibrant colors, no text no labels no words, clean composition`;
}

async function generateWithPollinations(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt);
  // Keep URL under ~2000 chars for reliability
  const url = `https://image.pollinations.ai/prompt/${encoded.substring(0, 800)}?width=1024&height=576&nologo=true&seed=${Date.now()}&model=flux`;
  
  const response = await fetch(url, { method: "GET", redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Pollinations error: ${response.status}`);
  }
  
  // Convert to base64 to avoid CORS issues
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:image/jpeg;base64,${base64}`;
}
