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

        const assessmentData = assessments.map((a: any) => {
            let pointsAttained = null;
            let pointsAvailable = null;

            // Extract points from rawGrade like "34/40"
            if (a.rawGrade) {
                const match = a.rawGrade.match(/([\d.]+)\s*\/\s*([\d.]+)/);
                if (match && match.length === 3) {
                    pointsAttained = parseFloat(match[1]);
                    pointsAvailable = parseFloat(match[2]);
                }
            } else if (a.rawPercent) {
                // Fallback: If no raw grade but pure percent exists, use percent out of 100
                pointsAttained = a.rawPercent;
                pointsAvailable = 100;
            }

            return {
                name: a.name,
                pointsAttained,
                pointsAvailable,
                date: a.date,
                notes: a.notes,
                category_id: a.categoryId || null,
                category_name: categories?.find((c: any) => c.id === a.categoryId)?.name || "Uncategorized"
            };
        });

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

THIS IS PURE MATHEMATICS - NO INTERPRETATION, NO TRENDS, NO ADJUSTMENTS:

1. CALCULATE WEIGHTED AVERAGE (USING TOTAL POINTS):
   - For EACH category: Sum the total \`pointsAttained\` and divide by the sum of \`pointsAvailable\` for all assessments in that category.
   - Example: Assessment 1 (30/40), Assessment 2 (15/20). Category Total: (30+15)/(40+20) = 45/60 = 75%.
   - Empty Categories: If a category has NO assessments, DO NOT use it. Do NOT factor its weight into the total.
   - Multiply the total Category Percentage by the Category Weight.

2. NORMALIZE FINAL PERCENTAGE:
   - Sum the active category weights. If it doesn't add to 1.0 (because of empty categories), normalize it: (Sum of category contributions) / (Sum of active weights).
   - If an assessment has NO pointsAttained/pointsAvailable, ignore it. Do NOT read notes.

3. CONVERT TO IB GRADE (STRICT BOUNDARIES):
   96-100% = 7
   90-95% = 6
   86-89% = 5
   76-85% = 4
   70-75% = 3
   50-69% = 2
   0-49% = 1
   NO OTHER RULES. JUST USE THE PURE FORMULA.

4. EXPLANATION FORMATTING:
   - You MUST format your explanation to explicitly show the exact math and weights used for each category.
   - Example Output: "Tests (weight 80%): 45/60 = 75.0% • Labs (weight 20%): 20/20 = 100.0% • Weighted Percentage: 87.5% • Grade 5"
   - Do NOT write paragraph sentences. Use the ' • ' separator to show the exact breakdown of Category (weight X%): SumAttained/SumAvailable = %.

Output strictly in this JSON format:
{
  "predictedGrade": number,
  "explanation": "Tests (weight 80%): 45/60 = 75.0% • Labs: ..."
}`
            : `Predict the final IB grade (1-7) for the SL (Standard Level) subject "${subject.name}".

Assessment data: ${JSON.stringify(assessmentData)}
Category weightings: ${JSON.stringify(categoryData)}
${hasUncategorized ? `\nCRITICAL: Uncategorized assessments have an implicit weight of ${(uncategorizedWeight * 100).toFixed(1)}% (remaining weight after categories).${uncategorizedWeight === 0 ? ' THIS MEANS UNCATEGORIZED ASSESSMENTS ARE WORTH 0% AND MUST BE COMPLETELY IGNORED IN YOUR CALCULATION.' : ''}` : ''}

THIS IS PURE MATHEMATICS - NO INTERPRETATION, NO TRENDS, NO ADJUSTMENTS:

1. CALCULATE WEIGHTED AVERAGE (USING TOTAL POINTS):
   - For EACH category: Sum the total \`pointsAttained\` and divide by the sum of \`pointsAvailable\` for all assessments in that category.
   - Example: Assessment 1 (30/40), Assessment 2 (15/20). Category Total: (30+15)/(40+20) = 45/60 = 75%.
   - Empty Categories: If a category has NO assessments, DO NOT use it. Do NOT factor its weight into the total.
   - Multiply the total Category Percentage by the Category Weight.

2. NORMALIZE FINAL PERCENTAGE:
   - Sum the active category weights. If it doesn't add to 1.0 (because of empty categories), normalize it: (Sum of category contributions) / (Sum of active weights).
   - If an assessment has NO pointsAttained/pointsAvailable, ignore it. Do NOT read notes.

3. CONVERT TO IB GRADE (STRICT BOUNDARIES):
   96-100% = 7
   90-95% = 6
   86-89% = 5
   76-85% = 4
   70-75% = 3
   50-69% = 2
   0-49% = 1
   NO OTHER RULES. JUST USE THE PURE FORMULA.

4. EXPLANATION FORMATTING:
   - You MUST format your explanation to explicitly show the exact math and weights used for each category.
   - Example Output: "Tests (weight 80%): 45/60 = 75.0% • Labs (weight 20%): 20/20 = 100.0% • Weighted Percentage: 87.5% • Grade 5"
   - Do NOT write paragraph sentences. Use the ' • ' separator to show the exact breakdown of Category (weight X%): SumAttained/SumAvailable = %.

Output strictly in this JSON format:
{
  "predictedGrade": number,
  "explanation": "Tests: 45/60 = 75.0% • Labs: ..."
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
                    content: "You are a mathematical calculator. Calculate the exact weighted average percentage and convert to an IB grade based strictly on the bounds provided. This is pure mathematics - no interpretation, no trends, no adjustments. Always respond with valid JSON only, no markdown formatting."
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
