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
            content: `You are an educational content creator. Given a question, create a clear explanation broken into scenes for an animated video. Return a JSON object with this exact structure:
{
  "title": "Short title for the topic",
  "scenes": [
    {
      "text": "1-2 sentence explanation for this scene",
      "imagePrompt": "Detailed prompt for generating an educational illustration for this concept. Be specific about colors, style (flat illustration, diagram, etc), and subject matter. Always specify: clean, modern educational illustration style, vibrant colors, no text in image."
    }
  ]
}
Create 4-6 scenes. Each scene should explain one concept building on the previous. Keep language clear and accessible. The imagePrompt should describe a visual that helps explain the concept.`
          },
          { role: "user", content: question }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_explanation",
              description: "Create a structured educational explanation with scenes",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  scenes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        imagePrompt: { type: "string" }
                      },
                      required: ["text", "imagePrompt"]
                    }
                  }
                },
                required: ["title", "scenes"]
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
