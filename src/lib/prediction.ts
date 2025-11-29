import { Assessment, Category, Subject } from '@/lib/types'

export type PredictionResult = {
    grade: number
    method: 'weighted-ib' | 'weighted-percent' | 'simple-average'
    details: string
}

/**
 * Gets the direct weights for categories (no normalization needed now - weights are already percentages)
 */
export function normalizeWeights(categories: Category[]): Record<string, number> {
    const weights: Record<string, number> = {}

    // Since raw weights are now direct percentages (0.0-1.0), we just use them directly
    categories.forEach(cat => {
        weights[cat.id] = cat.rawWeight
    })

    return weights
}

/**
 * Calculates a local mathematical prediction based on assessments and weights.
 * This serves as a fallback and baseline for the AI.
 */
export function calculateLocalPrediction(
    subject: Subject,
    assessments: Assessment[],
    categories: Category[]
): PredictionResult | null {
    if (assessments.length === 0) return null

    // 1. Map assessments to categories
    const assessmentsByCategory: Record<string, Assessment[]> = {}
    const uncategorized: Assessment[] = []

    assessments.forEach(a => {
        if (a.categoryId) {
            if (!assessmentsByCategory[a.categoryId]) {
                assessmentsByCategory[a.categoryId] = []
            }
            assessmentsByCategory[a.categoryId].push(a)
        } else {
            uncategorized.push(a)
        }
    })

    const isHL = subject.type === 'HL'

    // If no categories are defined, fall back to simple average of IB grades
    if (categories.length === 0) {
        const validGrades = assessments.filter(a => a.ibGrade !== null && a.ibGrade !== undefined).map(a => a.ibGrade!)
        if (validGrades.length === 0) return null

        const avg = validGrades.reduce((a, b) => a + b, 0) / validGrades.length
        return {
            grade: Math.round(avg),
            method: 'simple-average',
            details: `Average of ${validGrades.length} assessments (no categories)`
        }
    }

    const categoryWeights = normalizeWeights(categories)
    let totalWeightedScore = 0
    let totalUsedWeight = 0

    console.log('[PREDICTION DEBUG] Subject:', subject.name, 'Type:', subject.type)
    console.log('[PREDICTION DEBUG] Categories:', categories.map(c => ({ name: c.name, weight: c.rawWeight })))
    console.log('[PREDICTION DEBUG] Total assessments:', assessments.length, 'Uncategorized:', uncategorized.length)

    // 2. Calculate weighted score for categorized assessments
    for (const cat of categories) {
        const catAssessments = assessmentsByCategory[cat.id] || []
        console.log(`[PREDICTION DEBUG] Category "${cat.name}" (weight: ${cat.rawWeight}):`, catAssessments.length, 'assessments')
        if (catAssessments.length === 0) continue

        const catWeight = categoryWeights[cat.id]

        // Calculate average score for this category
        let catTotalScore = 0
        let validCount = 0

        for (const a of catAssessments) {
            let score: number | null = null

            if (isHL) {
                // HL: Use IB Grade directly
                if (a.ibGrade !== null && a.ibGrade !== undefined) {
                    score = a.ibGrade
                } else if (a.rawPercent !== null && a.rawPercent !== undefined) {
                    // Fallback: Estimate IB grade from percent (rough approximation)
                    score = estimateIbGradeFromPercent(a.rawPercent)
                }
            } else {
                // SL: Use Percentage (scaled 0-100)
                if (a.rawPercent !== null && a.rawPercent !== undefined) {
                    score = a.rawPercent
                } else if (a.ibGrade !== null && a.ibGrade !== undefined) {
                    // Fallback: Estimate percent from IB grade
                    score = estimatePercentFromIbGrade(a.ibGrade)
                }
            }

            if (score !== null) {
                catTotalScore += score
                validCount++
            }
        }

        if (validCount > 0) {
            const catAvg = catTotalScore / validCount
            console.log(`[PREDICTION DEBUG] Category "${cat.name}" avg:`, catAvg, '| Adding:', catAvg * catWeight)
            totalWeightedScore += catAvg * catWeight
            totalUsedWeight += catWeight
        }
    }

    // 3. Handle uncategorized assessments
    // Uncategorized assessments get the remaining weight (1.0 - sum of category weights)
    if (uncategorized.length > 0) {
        const totalCategoryWeight = categories.reduce((sum, cat) => sum + cat.rawWeight, 0)
        const uncategorizedWeight = Math.max(0, 1.0 - totalCategoryWeight)
        console.log('[PREDICTION DEBUG] Uncategorized weight:', uncategorizedWeight, '(1.0 -', totalCategoryWeight, ')')

        if (uncategorizedWeight > 0) {
            let uncatTotalScore = 0
            let validCount = 0

            for (const a of uncategorized) {
                let score: number | null = null

                if (isHL) {
                    if (a.ibGrade !== null && a.ibGrade !== undefined) {
                        score = a.ibGrade
                    } else if (a.rawPercent !== null && a.rawPercent !== undefined) {
                        score = estimateIbGradeFromPercent(a.rawPercent)
                    }
                } else {
                    if (a.rawPercent !== null && a.rawPercent !== undefined) {
                        score = a.rawPercent
                    } else if (a.ibGrade !== null && a.ibGrade !== undefined) {
                        score = estimatePercentFromIbGrade(a.ibGrade)
                    }
                }

                if (score !== null) {
                    uncatTotalScore += score
                    validCount++
                }
            }

            if (validCount > 0) {
                const uncatAvg = uncatTotalScore / validCount
                console.log('[PREDICTION DEBUG] Uncategorized avg:', uncatAvg, '| Adding:', uncatAvg * uncategorizedWeight)
                totalWeightedScore += uncatAvg * uncategorizedWeight
                totalUsedWeight += uncategorizedWeight
            }
        } else {
            console.log('[PREDICTION DEBUG] Skipping uncategorized (weight = 0)')
        }
    }

    console.log('[PREDICTION DEBUG] Total weighted score:', totalWeightedScore, '| Total used weight:', totalUsedWeight)

    if (totalUsedWeight === 0) return null

    // Since we're using direct percentage weights (0.0-1.0), the final score IS the weighted sum
    // We only divide by totalUsedWeight if it's less than 1.0 (to handle case where some categories are empty)
    // But if totalUsedWeight < 1.0, we should NOT scale up - just use the weighted score directly
    const finalScore = totalWeightedScore
    console.log('[PREDICTION DEBUG] Final score:', finalScore)

    if (isHL) {
        // HL result is already in 1-7 scale
        return {
            grade: Math.round(finalScore),
            method: 'weighted-ib',
            details: `Weighted average of IB grades (HL logic)`
        }
    } else {
        // SL result is in 0-100 scale, convert to 1-7
        const grade = convertPercentToIbGrade(finalScore)
        return {
            grade,
            method: 'weighted-percent',
            details: `Weighted average of ${finalScore.toFixed(1)}% (SL logic)`
        }
    }
}

// Helpers

function estimateIbGradeFromPercent(percent: number): number {
    if (percent >= 80) return 7
    if (percent >= 70) return 6
    if (percent >= 60) return 5
    if (percent >= 50) return 4
    if (percent >= 40) return 3
    if (percent >= 30) return 2
    return 1
}

function estimatePercentFromIbGrade(grade: number): number {
    switch (grade) {
        case 7: return 85
        case 6: return 75
        case 5: return 65
        case 4: return 55
        case 3: return 45
        case 2: return 35
        case 1: return 20
        default: return 50
    }
}

function convertPercentToIbGrade(percent: number): number {
    // SL boundaries from plan.md
    if (percent >= 96) return 7  // 96-100
    if (percent >= 90) return 6  // 90-95
    if (percent >= 86) return 5  // 86-89
    if (percent >= 76) return 4  // 76-85
    if (percent >= 70) return 3  // 70-75
    if (percent >= 50) return 2  // 50-69
    return 1  // 0-49
}
