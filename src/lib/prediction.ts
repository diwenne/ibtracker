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

    // 2. Calculate weighted score for categorized assessments
    for (const cat of categories) {
        const catAssessments = assessmentsByCategory[cat.id] || []
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
            totalWeightedScore += catAvg * catWeight
            totalUsedWeight += catWeight
        }
    }

    // 3. Handle uncategorized assessments
    // Uncategorized assessments get the remaining weight (1.0 - sum of category weights)
    if (uncategorized.length > 0) {
        const totalCategoryWeight = categories.reduce((sum, cat) => sum + cat.rawWeight, 0)
        const uncategorizedWeight = Math.max(0, 1.0 - totalCategoryWeight)

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
                totalWeightedScore += uncatAvg * uncategorizedWeight
                totalUsedWeight += uncategorizedWeight
            }
        }
    }

    if (totalUsedWeight === 0) return null

    // Re-normalize if some categories were empty
    const finalScore = totalWeightedScore / totalUsedWeight

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
    // Standard boundaries (approximate)
    if (percent >= 77) return 7
    if (percent >= 63) return 6
    if (percent >= 50) return 5
    if (percent >= 38) return 4
    if (percent >= 28) return 3
    if (percent >= 15) return 2
    return 1
}
