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
            date: a.date,
            notes: a.notes,
            category_id: a.categoryId || null,
            category_name: categories?.find((c: any) => c.id === a.categoryId)?.name || "Uncategorized"
        }));

        const categoryData = categories?.map((c: any) => ({
            id: c.id,
            name: c.name,
            weight: c.rawWeight // This is now a direct percentage (0.0-1.0)
        })) || [];

        // Calculate uncategorized weight
        const totalCategoryWeight = categories?.reduce((sum: number, c: any) => sum + c.rawWeight, 0) || 0;
        const uncategorizedWeight = Math.max(0, 1.0 - totalCategoryWeight);
        const hasUncategorized = assessments.some((a: any) => !a.categoryId);

        // Create subject-specific prompt based on HL vs SL
        const isHL = subject.type === "HL";

        const userPrompt = isHL
            ? `Predict the final IB grade (1-7) for the HL (Higher Level) subject "${subject.name}".

Assessment data: ${JSON.stringify(assessmentData)}
Category weightings: ${JSON.stringify(categoryData)}
${hasUncategorized ? `\nCRITICAL: Uncategorized assessments have an implicit weight of ${(uncategorizedWeight * 100).toFixed(1)}% (remaining weight after categories).${uncategorizedWeight === 0 ? ' THIS MEANS UNCATEGORIZED ASSESSMENTS ARE WORTH 0% AND MUST BE COMPLETELY IGNORED IN YOUR CALCULATION.' : ''}` : ''}

HL-SPECIFIC RULES (STRICT CONSERVATIVE APPROACH):
1. CALCULATE WEIGHTED AVERAGE FIRST:
   - Use ibGrade and rawPercent fields for context
   - Category weights are DIRECT PERCENTAGES (e.g., 0.2 = 20%, 0.5 = 50%)
   - Uncategorized assessments (if any) use the remaining weight
   - Compute weighted_avg = Σ(ibGrade × category_weight)
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
${hasUncategorized ? `\nCRITICAL: Uncategorized assessments have an implicit weight of ${(uncategorizedWeight * 100).toFixed(1)}% (remaining weight after categories).${uncategorizedWeight === 0 ? ' THIS MEANS UNCATEGORIZED ASSESSMENTS ARE WORTH 0% AND MUST BE COMPLETELY IGNORED IN YOUR CALCULATION.' : ''}` : ''}

THIS IS PURE MATHEMATICS - NO INTERPRETATION, NO TRENDS, NO ADJUSTMENTS:

IMPORTANT: Use rawPercent for calculations. ibGrade field is provided for reference only.

STEP 1: CALCULATE WEIGHTED AVERAGE PERCENTAGE (EXACT FORMULA):
1. For each category in categoryData:
   - category has: id, name, weight (0.0 to 1.0)
   - Find ALL assessments where assessment.category_id === category.id
   - If NO assessments in this category:
     * Assume average_rawPercent = 100% (benefit of the doubt)
     * category_contribution = category.weight × 100
   - If assessments exist:
     * Calculate average of rawPercent for those assessments only
     * category_contribution = category.weight × average_rawPercent

   CRITICAL: If the sum of all used weights (categories + uncategorized) is NOT 1.0, you MUST normalize the final result.
   Example: If weights sum to 1.0 (e.g. 0.55 + 0.45), just sum the contributions.
   Example: If weights sum to > 1.0 (e.g. 55 + 45 = 100), divide the total sum by the total weight.
   Formula: final_weighted_avg = (sum of contributions) / (sum of all weights)

2. For uncategorized assessments (where category_id === null):
   - Count how many assessments have category_id === null
   - If uncategorized_weight > 0:
     * Calculate average rawPercent of assessments with category_id === null
     * uncategorized_contribution = uncategorized_weight × average_rawPercent
   - If uncategorized_weight === 0:
     * uncategorized_contribution = 0
     * DO NOT use these assessments at all

3. weighted_avg_pct = (sum of all category_contributions + uncategorized_contribution) / (sum of all weights)

EXAMPLE WITH YOUR DATA:
- Category Silent Drills (id=X, weight=1.0), assessments with category_id=X: [100%]
  → contribution = 1.0 × 100 = 100
- Uncategorized (category_id=null): weight=0.0
  → contribution = 0
- Result: 100%

STEP 2: CONVERT TO IB GRADE (STRICT BOUNDARIES):
96-100% = 7
90-95% = 6
86-89% = 5
76-85% = 4
70-75% = 3
50-69% = 2
0-49% = 1

THAT'S IT. NO OTHER RULES. NO TRENDS. NO ADJUSTMENTS. JUST USE THE FORMULA.

Example:
- Category "Tests" weight=1.0, assessments=[100%]
  → contribution = 1.0 × 100 = 100
- Uncategorized weight=0.0
  → contribution = 0
- weighted_avg_pct = 100
- Grade = 7

Output strictly in this JSON format:
{
  "predictedGrade": number,
  "explanation": "Weighted average: X.X%. Grade boundary: Y."
}`;

        console.log('[AI PREDICT] Subject:', subject.name, 'Type:', subject.type);
        console.log('[AI PREDICT] Assessment data:', JSON.stringify(assessmentData, null, 2));
        console.log('[AI PREDICT] Category data:', JSON.stringify(categoryData, null, 2));
        console.log('[AI PREDICT] Uncategorized weight:', uncategorizedWeight);

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: isHL
                        ? "You are an expert IB Coordinator and teacher. Your task is to predict students' final IB grades (1-7) based on their assessment data. Always respond with valid JSON only, no markdown formatting."
                        : "You are a mathematical calculator. For SL subjects, calculate the exact weighted average percentage and convert to IB grade. This is pure mathematics - no interpretation, no trends, no adjustments. Always respond with valid JSON only, no markdown formatting."
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ],
            response_format: { type: "json_object" },
            temperature: isHL ? 0.3 : 0.1,
        });

        const responseText = completion.choices[0].message.content;
        if (!responseText) {
            throw new Error("No response from OpenAI");
        }

        const prediction = JSON.parse(responseText);
        console.log('[AI PREDICT] AI Response:', prediction);

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
