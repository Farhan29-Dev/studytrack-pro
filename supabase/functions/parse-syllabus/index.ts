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
    const { fileContent, fileName, fileType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Parsing syllabus file:", fileName, "type:", fileType);

    const systemPrompt = `You are an expert syllabus parser. Extract ONLY the actual content from the syllabus document.

CRITICAL PARSING RULES:
1. Look for patterns like "UNIT – I:", "UNIT - I:", "Unit 1:", "UNIT I:" followed by the unit title
2. Topics are usually listed as comma-separated items after each unit heading
3. Ignore "CO1", "CO2" etc. (course outcome markers) - they are NOT topics
4. Ignore hours like "[7Hrs.]" - they are NOT topics
5. Extract ONLY the actual topic names mentioned, NOT generic/random topics
6. If no clear subject name is found, use "Subject" as the name

PARSING EXAMPLE:
Input: "UNIT – I: The Theory Of Automata CO1 Introduction to automata theory, Examples of automata machine, Finite automata..."

Output: Unit name = "Unit I: The Theory Of Automata", Topics = ["Introduction to automata theory", "Examples of automata machine", "Finite automata", ...]

Return a JSON object with this exact structure:
{
  "subjects": [
    {
      "name": "Subject Name (derive from content or use generic name)",
      "color": "#3B82F6",
      "units": [
        {
          "name": "Unit I: Unit Title",
          "topics": ["Actual Topic 1", "Actual Topic 2"]
        }
      ]
    }
  ]
}

IMPORTANT: Extract ONLY what's actually written in the document. DO NOT generate or hallucinate topics.
Use these colors for subjects: #3B82F6, #10B981, #F59E0B, #EF4444, #8B5CF6, #EC4899, #06B6D4, #F97316`;

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
          { role: "user", content: `Parse the following syllabus content and extract the subjects, units, and topics:\n\n${fileContent}` }
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
      
      throw new Error("Failed to parse syllabus");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
      throw new Error("Invalid response format from AI");
    }

    console.log("Successfully parsed syllabus with", parsedData.subjects?.length, "subjects");

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Parse syllabus error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
