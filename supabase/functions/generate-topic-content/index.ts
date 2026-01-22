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
    const { topicName, subjectName, unitName, reviewLevel = 1, existingNotes = "" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating content for topic:", topicName, "in", subjectName, "at review level:", reviewLevel);

    // Progressive notes system - content depth increases with review level
    const getLevelInstructions = (level: number) => {
      if (level === 1) {
        return `
## Level 1 - First Review (Concise Overview)
Create a brief, scannable summary:
- Maximum 150 words
- Use bullet points exclusively
- Focus on 3-5 key concepts only
- Include essential definitions in bold
- No examples at this level
- Mobile-friendly formatting`;
      } else if (level === 2) {
        return `
## Level 2 - Second Review (Enhanced Understanding)
Extend the existing notes with:
- Richer explanations for each concept
- 1-2 relevant examples per key point
- **Highlighted keywords** for easy scanning
- Common misconceptions to avoid
- Keep total length under 300 words
- Build upon existing content, don't repeat`;
      } else {
        return `
## Level 3+ - Advanced Review (Exam Ready)
Create comprehensive exam-ready notes:
- Detailed explanations with depth
- Multiple examples and applications
- Tips for remembering key concepts
- Common exam questions and approaches
- Q&A format for self-testing
- Connection to related topics
- Mnemonics or memory aids if applicable
- Maximum 500 words
- Extend existing notes, maintain continuity`;
      }
    };

    const systemPrompt = `You are an expert educational content creator specializing in progressive learning materials.

${getLevelInstructions(reviewLevel)}

${existingNotes ? `
## Existing Notes to Extend:
${existingNotes}

IMPORTANT: Do NOT regenerate from scratch. Build upon and enrich the existing notes while maintaining continuity.
` : ""}

## Quiz Requirements:
- Generate ${reviewLevel === 1 ? "3" : reviewLevel === 2 ? "5" : "7"} quiz questions
- Difficulty should match review level
- Level 1: Basic recall questions
- Level 2: Understanding and application questions  
- Level 3+: Analysis and synthesis questions
- Include clear explanations for each answer

## Output Format (JSON):
{
  "summary": "The progressive summary content...",
  "reviewLevel": ${reviewLevel},
  "quiz": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this is correct and why others are wrong"
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate educational content for this topic:\n\nSubject: ${subjectName}\nUnit: ${unitName}\nTopic: ${topicName}` }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Failed to generate content");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid response format from AI");
    }

    console.log("Successfully generated content for topic:", topicName);

    return new Response(
      JSON.stringify({ success: true, data: parsedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
