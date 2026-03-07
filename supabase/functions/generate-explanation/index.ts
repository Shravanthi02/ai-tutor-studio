import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
            content: `You are an expert educational content creator. Given a question, create a thorough, detailed explanation broken into scenes for an animated video, AND a comprehensive written text answer.`
          },
          {
            role: "user",
            content: `Create an educational explanation for: ${question}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_explanation",
              description: "Create a structured educational explanation with scenes for an animated video.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Engaging title for the explanation" },
                  fullAnswer: { type: "string", description: "Comprehensive 3-5 paragraph explanation, at least 200 words" },
                  scenes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "2-3 sentence scene narration, rich with detail" },
                        imagePrompt: { type: "string", description: "Detailed illustration description: clean modern educational illustration, vibrant colors, no text in image" }
                      },
                      required: ["text", "imagePrompt"],
                      additionalProperties: false
                    },
                    description: "6-8 scenes building concepts progressively from simple to complex"
                  }
                },
                required: ["title", "fullAnswer", "scenes"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_explanation" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No response from AI");

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
