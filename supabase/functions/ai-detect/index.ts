// Edge function: detect background chroma + analyze animation via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { task, imageBase64, imagesBase64 } = body as {
      task: "detectSubject" | "analyzeAnimation";
      imageBase64?: string;
      imagesBase64?: string[];
    };

    if (task === "detectSubject") {
      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "imageBase64 required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tools = [
        {
          type: "function",
          function: {
            name: "report_background",
            description:
              "Report the background color, tolerance, subject box, seeds and edge refinement for a sprite frame.",
            parameters: {
              type: "object",
              properties: {
                chromaColor: {
                  type: "string",
                  description: "Hex color #RRGGBB of the dominant background",
                },
                tolerance: { type: "number", description: "0-100 chroma tolerance" },
                subjectBox: {
                  type: "object",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    w: { type: "number" },
                    h: { type: "number" },
                  },
                  required: ["x", "y", "w", "h"],
                  additionalProperties: false,
                },
                edgeRefinement: {
                  type: "object",
                  properties: {
                    erosion: { type: "number", description: "0-3 px alpha erode" },
                    blur: { type: "number", description: "0-3 px alpha feather" },
                  },
                  required: ["erosion", "blur"],
                  additionalProperties: false,
                },
                reasoning: { type: "string" },
              },
              required: [
                "chromaColor",
                "tolerance",
                "subjectBox",
                "edgeRefinement",
                "reasoning",
              ],
              additionalProperties: false,
            },
          },
        },
      ];

      const aiResp = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You analyze game sprite frames for background removal. Always call report_background with conservative tolerance values (8-25 typical for clean sheets) and pixel-accurate subject boxes (x,y,w,h are absolute pixels in the source image).",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this sprite frame and call report_background.",
                },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "report_background" } },
        }),
      });

      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiResp.json();
      const call = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!call) {
        return new Response(JSON.stringify({ error: "no tool call" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const args = JSON.parse(call.function.arguments);
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (task === "analyzeAnimation") {
      const imgs = imagesBase64 ?? [];
      const tools = [
        {
          type: "function",
          function: {
            name: "report_animation",
            description: "Report animation insights for a sprite sequence.",
            parameters: {
              type: "object",
              properties: {
                type: { type: "string" },
                description: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                vibe: { type: "string" },
                optimizationTips: { type: "array", items: { type: "string" } },
              },
              required: ["type", "description", "tags", "vibe", "optimizationTips"],
              additionalProperties: false,
            },
          },
        },
      ];

      const userContent: any[] = [
        {
          type: "text",
          text: "Analyze this animation sequence and call report_animation.",
        },
        ...imgs.map((u) => ({ type: "image_url", image_url: { url: u } })),
      ];

      const aiResp = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are an expert sprite animator. Categorize, describe, tag and give optimization tips for the supplied frame sequence.",
            },
            { role: "user", content: userContent },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "report_animation" } },
        }),
      });

      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please wait a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiResp.json();
      const call = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!call) {
        return new Response(JSON.stringify({ error: "no tool call" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const args = JSON.parse(call.function.arguments);
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown task" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-detect error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
