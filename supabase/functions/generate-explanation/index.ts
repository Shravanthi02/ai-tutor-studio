import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert educational content creator. Given a question, create a thorough, detailed explanation broken into scenes for an animated video, PLUS a comprehensive text answer.

Rules:
- Create 6-8 scenes for a detailed animated explanation
- Each scene text should be 2-3 sentences, rich with detail
- Build concepts progressively from simple to complex
- Use analogies and real-world examples
- The fullAnswer should be a comprehensive 3-5 paragraph written explanation covering the topic in depth, suitable for reading after watching the video
- imagePrompt must describe vivid, detailed educational illustrations`
          },
          { role: "user", content: question }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_explanation",
              description: "Create a structured educational explanation with scenes and full text answer",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Engaging title for the topic" },
                  fullAnswer: { type: "string", description: "Comprehensive 3-5 paragraph text explanation of the topic" },
                  scenes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "2-3 sentence scene narration" },
                        imagePrompt: { type: "string", description: "Detailed illustration prompt. Always include: clean modern educational illustration, vibrant colors, no text in image, specific visual elements" }
                      },
                      required: ["text", "imagePrompt"]
                    }
                  }
                },
                required: ["title", "fullAnswer", "scenes"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_explanation" } }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response");

    const explanation = JSON.parse(toolCall.function.arguments);

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
