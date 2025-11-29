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

HL-SPECIFIC RULES (STRICT CONSERVATIVE APPROACH):
1. CALCULATE WEIGHTED AVERAGE FIRST:
   - Compute weighted_avg = Σ(ib_grade × normalized_weight)
   - This weighted average is your BASELINE - do NOT deviate more than ±1 grade from it
   - Round DOWN if between grades (e.g., 5.7 → 5, NOT 6)

2. BE EXTREMELY CONSERVATIVE:
   - NEVER predict a grade the student has NEVER achieved
   - If best grade ever is 6, the maximum prediction is 6 (NOT 7)
   - If student got 5-6 range, predict on the LOWER end (lean towards 5, not 6)
   - Only predict the highest achieved grade if it appears in MULTIPLE recent high-weight assessments

3. TREND ADJUSTMENTS (VERY LIMITED):
   - Improvement trend (4→5→6): Predict 5 or 6, NOT 7 (they never got 7)
   - Consistent performance (all 5s): Predict 5, do NOT bump to 6
   - Mixed performance (4s, 5s, 6s): Weighted average, round DOWN
   - Only adjust UP by 1 if student has 3+ recent high-weight assessments at that higher grade

4. WEIGHTING:
   - Recent high-weight assessments (Exams, IAs) matter most
   - But still constrained by the weighted average ±1 rule

5. NOTES ARE CRITICAL - READ CAREFULLY:
   - NOTES field contains important context that MUST significantly affect weight
   - If notes say "worth VERY little" or "doesn't count" → reduce that assessment's weight by 50-90%
   - If notes say "bad day", "sick", "unfair" → reduce weight by 30-50%
   - If notes say "extra important", "final", "cumulative" → increase weight by 20-30%
   - If notes say "practice only" or "mock" → reduce weight by 40-60%
   - Empty notes = use normal weight
   - NEVER ignore notes - they directly modify how much an assessment should count

6. STRICT BOUNDARIES:
   - Weighted avg 6.3 with max grade 6 → predict 6 (NOT 7)
   - Weighted avg 5.7 with grades 5-6 → predict 5 (round down)
   - Weighted avg 4.9 with improvement → predict 5 ONLY if multiple recent 5s exist

Output strictly in this JSON format:
{
  "predictedGrade": number,
  "explanation": "string (max 2 sentences citing weighted average and constraints)"
}`
            : `Predict the final IB grade (1-7) for the SL (Standard Level) subject "${subject.name}".

Assessment data: ${JSON.stringify(assessmentData)}
Category weightings: ${JSON.stringify(categoryData)}

SL-SPECIFIC RULES (STRICT MATHEMATICAL APPROACH):
1. CALCULATE WEIGHTED AVERAGE PERCENTAGE:
   - weighted_avg_pct = Σ(raw_percentage × normalized_weight)
   - This is your PRIMARY and DOMINANT predictor
   - Convert to IB grade using STRICT boundaries:
     * 96-100% = 7, 90-95% = 6, 86-89% = 5, 76-85% = 4, 70-75% = 3, 50-69% = 2, 0-49% = 1

2. BE EXTREMELY STRICT WITH BOUNDARIES:
   - 95.9% = 6 (NOT 7, must be ≥96% for 7)
   - 89.9% = 5 (NOT 6, must be ≥90% for 6)
   - 85.9% = 4 (NOT 5, must be ≥86% for 5)
   - Round DOWN when at boundary (95.5% → 6, NOT 7)

3. TREND ADJUSTMENTS (ALMOST NONE):
   - Trends can ONLY adjust by ±1 grade from weighted average
   - Only adjust UP if:
     * Student has 3+ recent high-weight assessments at higher grade
     * AND weighted avg is within 2% of next boundary (e.g., 94.5%+ to consider 7)
   - Default: stick to weighted average conversion, NO adjustment

4. NEVER PREDICT ABOVE MAXIMUM ACHIEVED:
   - If best percentage is 92% (grade 6), NEVER predict 7
   - If percentages range 85-89% (grades 4-5), predict 5 or lower
   - Be conservative: lean towards lower grade

5. WEIGHTING STRICT ENFORCEMENT:
   - Higher weight categories (Exams, IAs) dominate the weighted average
   - A single high-weight exam at 88% outweighs 5 quizzes at 95%

6. NOTES ARE CRITICAL - READ CAREFULLY:
   - NOTES field contains important context that MUST significantly affect weight
   - If notes say "worth VERY little" or "doesn't count" → reduce that assessment's weight by 50-90%
   - If notes say "bad day", "sick", "unfair" → reduce weight by 30-50%
   - If notes say "extra important", "final", "cumulative" → increase weight by 20-30%
   - If notes say "practice only" or "mock" → reduce weight by 40-60%
   - Empty notes = use normal weight
   - NEVER ignore notes - they directly modify how much an assessment should count

7. FINAL CHECK:
   - Does prediction match weighted_avg_pct conversion? If not, explain why
   - If weighted avg is 91% (grade 6), prediction should be 6 unless strong evidence

Output strictly in this JSON format:
{
  "predictedGrade": number,
  "explanation": "string (max 2 sentences stating weighted avg % and boundary)"
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
