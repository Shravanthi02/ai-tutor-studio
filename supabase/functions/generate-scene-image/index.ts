import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("Missing prompt");

    // Use Pollinations.ai (free, reliable, no API key needed)
    const imageUrl = await generateWithPollinations(prompt);

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

async function generateWithPollinations(prompt: string): Promise<string> {
  const enhancedPrompt = `Create a clear, easy-to-understand educational visualization showing: ${prompt}. CRITICAL: Depict the EXACT subject described - not something related or symbolic. Make it crystal clear what concept is being shown. Style: educational diagram quality, clean simple composition, clear focal point, bright illumination, visible details, scientific accuracy, beginner-friendly illustration, no abstract art, no clutter, no text no labels`;
  const seed = Math.floor(Math.random() * 10000000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=576&nologo=true&seed=${seed}&model=flux-pro&enhance=true`;

  // Return the URL directly - let the client load it
  // This avoids base64 conversion which can cause memory/timeout issues
  return url;
}
