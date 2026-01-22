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

    const systemPrompt = `You are an expert syllabus parser. Your job is to extract EXACTLY what is written in the document - nothing more, nothing less.

CRITICAL PARSING RULES:
1. UNIT PATTERNS: Look for "UNIT – I:", "UNIT - I:", "Unit 1:", "UNIT I:", "MODULE I:" etc. followed by the unit title
2. TOPICS: Usually listed as comma-separated items OR line-by-line after each unit heading
3. IGNORE these markers completely (they are NOT topics):
   - "CO1", "CO2", "CO3" etc. (Course Outcome markers)
   - "[7Hrs.]", "[8 Hrs]", "(8 hours)" etc. (Hour notations)
   - "L1", "L2", "L3" etc. (Level markers)
   - Reference book names and author names
4. SUBJECT NAME: Look for the course title at the top. If not found, derive from unit titles or use "Subject"
5. EXTRACT VERBATIM: Copy topic names exactly as written, don't paraphrase or generate new ones

EXAMPLE INPUT:
"UNIT – I: The Theory Of Automata CO1 [7Hrs.]
Introduction to automata theory, Examples of automata machine, Finite automata, Deterministic finite automata"

EXAMPLE OUTPUT:
{
  "subjects": [{
    "name": "Theory of Computation",
    "color": "#3B82F6",
    "units": [{
      "name": "Unit I: The Theory Of Automata",
      "topics": ["Introduction to automata theory", "Examples of automata machine", "Finite automata", "Deterministic finite automata"]
    }]
  }]
}

Return a JSON object with this EXACT structure:
{
  "subjects": [
    {
      "name": "Subject Name",
      "color": "#3B82F6",
      "units": [
        {
          "name": "Unit I: Unit Title",
          "topics": ["Topic 1", "Topic 2", "Topic 3"]
        }
      ]
    }
  ]
}

CRITICAL: 
- Extract ONLY what's actually in the document text
- DO NOT invent, hallucinate, or add topics that aren't explicitly mentioned
- Preserve the exact wording of topics from the document
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
