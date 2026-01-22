import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topicNames, subjectName, questionCount = 10 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const topicsList = topicNames.join(", ");

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
            content: `You are an expert test creator. Generate MCQ questions for students.
Return a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "Clear question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "difficulty": "easy|medium|hard",
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}

Guidelines:
- Create ${questionCount} questions covering the given topics
- Mix difficulty levels (30% easy, 50% medium, 20% hard)
- Make questions clear and unambiguous
- All 4 options should be plausible
- Explanations should be helpful for learning`
          },
          {
            role: "user",
            content: `Generate ${questionCount} MCQ questions for ${subjectName} covering these topics: ${topicsList}`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate questions");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      throw new Error("Invalid response format from AI");
    }

    return new Response(
      JSON.stringify(parsedContent),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
