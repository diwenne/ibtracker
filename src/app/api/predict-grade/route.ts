import OpenAI from "openai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { subject, assessments, categories } = body;

        if (!subject || !assessments) {
            return NextResponse.json({ error: "Missing subject or assessments data" }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
        }

        // Initialize Supabase client to verify session and update data
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {
                            // The `setAll` method was called from a Server Component.
                            // This can be ignored if you have middleware refreshing
                            // user sessions.
                        }
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: apiKey,
        });

        const assessmentData = assessments.map((a: any) => ({
            name: a.name,
            ibGrade: a.ibGrade,
            rawPercent: a.rawPercent,
            rawGrade: a.rawGrade,
            date: a.date,
            notes: a.notes,
            category: categories?.find((c: any) => c.id === a.categoryId)?.name || "Uncategorized"
        }));

        const categoryData = categories?.map((c: any) => ({
            name: c.name,
            weight: c.raw_weight
        })) || [];

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are an expert IB Coordinator and teacher. Your task is to predict students' final IB grades (1-7) based on their assessment data. Always respond with valid JSON only, no markdown formatting."
                },
                {
                    role: "user",
                    content: `Predict the final IB grade (1-7) for the subject "${subject.name}" (${subject.type}).

Assessment data: ${JSON.stringify(assessmentData)}
Category weightings: ${JSON.stringify(categoryData)}

Rules:
1. HL vs SL:
   - For HL (Higher Level) subjects, prioritize the trend of IB Grades (1-7). Improvement over time is key. Use the "scaling" logic where high percentages (90%+) are required for a 7, but consistent 6s and 7s in recent assessments are a strong indicator.
   - For SL (Standard Level) subjects, prioritize the weighted average of percentages if available. If not, use the weighted average of IB grades.
2. Weighting:
   - Respect the category weights. Assessments in categories with higher weights (e.g., "Exams", "IAs") contribute more to the final grade.
   - If no categories are defined, treat all assessments equally or prioritize recent ones.
3. Notes:
   - Pay attention to "notes". If a student had a bad day or a specific reason for a low grade, discount it slightly.
4. Trend:
   - Recent performance is more indicative of the final grade than performance from months ago.

Output strictly in this JSON format:
{
  "predictedGrade": number,
  "explanation": "string (max 2 sentences)"
}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const responseText = completion.choices[0].message.content;
        if (!responseText) {
            throw new Error("No response from OpenAI");
        }

        const prediction = JSON.parse(responseText);

        // Update the subject in the database
        const { error: updateError } = await supabase
            .from('subjects')
            .update({
                ai_predicted_grade: prediction.predictedGrade,
                ai_explanation: prediction.explanation,
                prediction_dirty: false
            })
            .eq('id', subject.id);

        if (updateError) {
            console.error("Error updating subject:", updateError);
            return NextResponse.json({ error: "Failed to update subject" }, { status: 500 });
        }

        return NextResponse.json(prediction);

    } catch (error) {
        console.error("Prediction error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
