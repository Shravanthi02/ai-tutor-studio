import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are an expert educational content creator. Given a question, create a thorough, detailed explanation broken into scenes for an animated video, AND a comprehensive written text answer.

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact structure:
{
  "title": "Engaging title",
  "fullAnswer": "Comprehensive 3-5 paragraph explanation (at least 200 words)",
  "scenes": [
    {"text": "2-3 sentence scene narration", "imagePrompt": "Detailed illustration description with: clean modern educational illustration, vibrant colors, no text in image"}
  ]
}

Rules:
- Create 6-8 scenes
- Each scene text should be 2-3 sentences, rich with detail
- Build concepts progressively from simple to complex
- Use analogies and real-world examples
- fullAnswer must be at least 200 words
- imagePrompt must describe vivid, detailed educational illustrations

Question: ${question}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Gemini API error");
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) throw new Error("No response from Gemini");

    const explanation = JSON.parse(textContent);

    return new Response(JSON.stringify(explanation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
