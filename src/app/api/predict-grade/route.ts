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

        // Create subject-specific prompt based on HL vs SL
        const isHL = subject.type === "HL";

        const userPrompt = isHL
            ? `Predict the final IB grade (1-7) for the HL (Higher Level) subject "${subject.name}".

Assessment data: ${JSON.stringify(assessmentData)}
Category weightings: ${JSON.stringify(categoryData)}

HL-SPECIFIC RULES (TREND-FOCUSED):
1. PRIMARY FOCUS: Look for improvement trends and consistency in recent assessments
   - Recent IB grades (6s and 7s) are strong indicators, especially if showing improvement
   - A student improving from 4→5→6 is likely to score 6 or higher
   - Consistent 6s and 7s in recent high-weight assessments (Exams, IAs) strongly predict a final 6-7
2. WEIGHTING: Assessments with higher weights (Exams, IAs) influence the prediction MORE than quizzes
   - Recent high-weight assessments carry the most influence
3. PERCENTAGES: Raw percentages are LESS meaningful for HL due to heavy teacher scaling/curves
   - Focus on the IB grade trend, not the raw percentage
4. NOTES: If notes mention "bad day", "sick", or external factors, discount that assessment slightly
5. TIME DECAY: Older assessments matter less than recent performance

Output strictly in this JSON format:
{
  "predictedGrade": number,
  "explanation": "string (max 2 sentences explaining the trend or consistency observed)"
}`
            : `Predict the final IB grade (1-7) for the SL (Standard Level) subject "${subject.name}".

Assessment data: ${JSON.stringify(assessmentData)}
Category weightings: ${JSON.stringify(categoryData)}

SL-SPECIFIC RULES (AVERAGE-FOCUSED):
1. PRIMARY FOCUS: Calculate weighted average of raw percentages
   - Convert weighted average percentage to IB grade band using SL boundaries:
     * 96-100% = 7, 90-95% = 6, 86-89% = 5, 76-85% = 4, 70-75% = 3, 50-69% = 2, 0-49% = 1
   - This weighted average is the PRIMARY predictor
2. WEIGHTING: Respect category weights strictly
   - Higher weight categories (Exams, IAs) contribute more to the weighted average
3. TREND (MINOR): Only make SMALL adjustments for trends
   - If a student is clearly improving, you may bump up by 1 grade maximum
   - If declining, you may lower by 1 grade maximum
   - Most of the time, stick to the weighted average
4. NOTES: If notes mention "bad day", "sick", or external factors, discount that assessment slightly
5. PERCENTAGES ARE KEY: Unlike HL, percentages directly map to IB grades for SL

Output strictly in this JSON format:
{
  "predictedGrade": number,
  "explanation": "string (max 2 sentences explaining the weighted average and any minor trend adjustments)"
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are an expert IB Coordinator and teacher. Your task is to predict students' final IB grades (1-7) based on their assessment data. Always respond with valid JSON only, no markdown formatting."
                },
                {
                    role: "user",
                    content: userPrompt
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
