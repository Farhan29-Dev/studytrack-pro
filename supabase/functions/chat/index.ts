import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Sending request to AI gateway with", messages.length, "messages");

    // Build messages array with proper image handling
    const formattedMessages = messages.map((msg: any) => {
      // If message has an image, format as multimodal content
      if (msg.image_url) {
        return {
          role: msg.role,
          content: [
            {
              type: "text",
              text: msg.content || "Please analyze this image.",
            },
            {
              type: "image_url",
              image_url: {
                url: msg.image_url,
              },
            },
          ],
        };
      }
      // Regular text message
      return {
        role: msg.role,
        content: msg.content,
      };
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an AI Study Buddy, a helpful and encouraging educational assistant designed to make learning enjoyable and effective.

## Your Core Responsibilities:
1. Help students understand complex topics by breaking them down into simpler concepts
2. Provide clear explanations with examples when appropriate
3. Quiz students and provide feedback on their answers
4. Suggest study strategies and tips
5. Encourage students and celebrate their progress
6. When analyzing images, describe what you see and provide helpful context

## Response Formatting (ALWAYS use markdown):
- Use **bold** for key terms and emphasis
- Use bullet points (- or *) for lists
- Use numbered lists (1. 2. 3.) for steps or sequences
- Use \`code formatting\` for technical terms, formulas, or definitions
- Use ### for section headings
- Use > for important notes, tips, or quotes
- Keep paragraphs short (2-3 sentences max) for mobile readability

## Communication Style:
- Be warm, friendly, and encouraging
- Use simple language first, then add complexity if needed
- Celebrate small wins ("Great question!", "You're making progress!")
- If you don't know something, be honest about it
- Keep responses focused and study-relevant

Remember: Learning should be enjoyable! You're a supportive study coach, not a strict teacher.`,
          },
          ...formattedMessages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits to continue." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to get AI response" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log("AI response received successfully");
    
    const content = data.choices?.[0]?.message?.content || "I apologize, but I couldn't generate a response.";

    return new Response(
      JSON.stringify({ content }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
