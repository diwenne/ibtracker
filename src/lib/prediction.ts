import { Assessment, Category, Subject } from '@/lib/types'

export type PredictionResult = {
    grade: number
    percentage?: number
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
    let totalWeightedPercent = 0
    let totalUsedWeight = 0
    let totalRealWeight = 0 // Weight from categories that actually have assessments

    console.log('[PREDICTION DEBUG] Subject:', subject.name, 'Type:', subject.type)
    console.log('[PREDICTION DEBUG] Categories:', categories.map(c => ({ name: c.name, weight: c.rawWeight })))
    console.log('[PREDICTION DEBUG] Total assessments:', assessments.length, 'Uncategorized:', uncategorized.length)

    // 2. Calculate weighted score for categorized assessments
    for (const cat of categories) {
        const catAssessments = assessmentsByCategory[cat.id] || []
        const catWeight = categoryWeights[cat.id]

        console.log(`[PREDICTION DEBUG] Category "${cat.name}" (weight: ${cat.rawWeight}):`, catAssessments.length, 'assessments')

        if (catAssessments.length === 0) {
            // Assume 100% for empty categories to avoid penalty
            const perfectScore = isHL ? 7 : 100
            console.log(`[PREDICTION DEBUG] Category "${cat.name}" empty - assuming 100% (${perfectScore})`)
            totalWeightedScore += perfectScore * catWeight
            totalWeightedPercent += 100 * catWeight
            totalUsedWeight += catWeight
            continue
        }



        // Calculate average score for this category
        let catTotalScore = 0
        let catTotalPercent = 0
        let validCount = 0

        for (const a of catAssessments) {
            let score: number | null = null
            let percent: number | null = null

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
                    score = estimatePercentFromIbGrade(a.ibGrade, isHL)
                }
            }

            // Calculate percent for display/SL logic
            if (a.rawPercent !== null && a.rawPercent !== undefined) {
                percent = a.rawPercent
            } else if (a.ibGrade !== null && a.ibGrade !== undefined) {
                percent = estimatePercentFromIbGrade(a.ibGrade, isHL)
            }

            if (score !== null) {
                catTotalScore += score
                if (percent !== null) catTotalPercent += percent
                validCount++
            }
        }

        if (validCount > 0) {
            const catAvg = catTotalScore / validCount
            const catPercentAvg = catTotalPercent / validCount
            console.log(`[PREDICTION DEBUG] Category "${cat.name}" avg:`, catAvg, '| Adding:', catAvg * catWeight)
            totalWeightedScore += catAvg * catWeight
            totalWeightedPercent += catPercentAvg * catWeight
            totalUsedWeight += catWeight
            totalRealWeight += catWeight
        }
    }

    // 3. Handle uncategorized assessments
    // Uncategorized assessments get the remaining weight (1.0 - sum of category weights)
    const totalCategoryWeight = categories.reduce((sum, cat) => sum + cat.rawWeight, 0)
    const uncategorizedWeight = Math.max(0, 1.0 - totalCategoryWeight)

    if (uncategorized.length > 0) {
        console.log('[PREDICTION DEBUG] Uncategorized weight:', uncategorizedWeight, '(1.0 -', totalCategoryWeight, ')')

        if (uncategorizedWeight > 0) {
            let uncatTotalScore = 0
            let uncatTotalPercent = 0
            let validCount = 0

            for (const a of uncategorized) {
                let score: number | null = null
                let percent: number | null = null

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
                        score = estimatePercentFromIbGrade(a.ibGrade, isHL)
                    }
                }

                if (a.rawPercent !== null && a.rawPercent !== undefined) {
                    percent = a.rawPercent
                } else if (a.ibGrade !== null && a.ibGrade !== undefined) {
                    percent = estimatePercentFromIbGrade(a.ibGrade, isHL)
                }

                if (score !== null) {
                    uncatTotalScore += score
                    if (percent !== null) uncatTotalPercent += percent
                    validCount++
                }
            }

            if (validCount > 0) {
                const uncatAvg = uncatTotalScore / validCount
                const uncatPercentAvg = uncatTotalPercent / validCount
                console.log('[PREDICTION DEBUG] Uncategorized avg:', uncatAvg, '| Adding:', uncatAvg * uncategorizedWeight)
                totalWeightedScore += uncatAvg * uncategorizedWeight
                totalWeightedPercent += uncatPercentAvg * uncategorizedWeight
                totalUsedWeight += uncategorizedWeight
            } else {
                // Assume 100% for empty uncategorized section if it has weight
                const perfectScore = isHL ? 7 : 100
                console.log(`[PREDICTION DEBUG] Uncategorized empty - assuming 100% (${perfectScore})`)
                totalWeightedScore += perfectScore * uncategorizedWeight
                totalWeightedPercent += 100 * uncategorizedWeight
                totalUsedWeight += uncategorizedWeight
            }
        } else {
            console.log('[PREDICTION DEBUG] Skipping uncategorized (weight = 0)')
        }
    }

    console.log('[PREDICTION DEBUG] Total weighted score:', totalWeightedScore, '| Total used weight:', totalUsedWeight, '| Total real weight:', totalRealWeight)

    if (totalUsedWeight === 0) return null

    // Fallback: If we have NO real weight (all categories empty) but we DO have uncategorized assessments
    // that were ignored because uncategorizedWeight was 0, we should use the uncategorized average.
    if (totalRealWeight === 0 && uncategorized.length > 0 && uncategorizedWeight === 0) {
        console.log('[PREDICTION DEBUG] No real category data, falling back to uncategorized average')
        let uncatTotalScore = 0
        let uncatTotalPercent = 0
        let validCount = 0

        for (const a of uncategorized) {
            let score: number | null = null
            let percent: number | null = null

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
                    score = estimatePercentFromIbGrade(a.ibGrade, isHL)
                }
            }

            if (a.rawPercent !== null && a.rawPercent !== undefined) {
                percent = a.rawPercent
            } else if (a.ibGrade !== null && a.ibGrade !== undefined) {
                percent = estimatePercentFromIbGrade(a.ibGrade, isHL)
            }

            if (score !== null) {
                uncatTotalScore += score
                if (percent !== null) uncatTotalPercent += percent
                validCount++
            }
        }

        if (validCount > 0) {
            const avgScore = uncatTotalScore / validCount
            const avgPercent = uncatTotalPercent / validCount

            if (isHL) {
                return {
                    grade: Math.round(avgScore),
                    percentage: avgPercent,
                    method: 'simple-average',
                    details: `Average of ${validCount} uncategorized assessments (categories empty)`
                }
            } else {
                const roundedScore = Math.round(avgScore) // For SL, score IS percent
                const grade = convertPercentToIbGrade(roundedScore)
                return {
                    grade,
                    percentage: avgScore,
                    method: 'simple-average',
                    details: `Average of ${avgScore.toFixed(1)}% (categories empty)`
                }
            }
        }
    }

    // Since we're using direct percentage weights (0.0-1.0), the final score IS the weighted sum
    // We only divide by totalUsedWeight if it's less than 1.0 (to handle case where some categories are empty)
    // But if totalUsedWeight < 1.0, we should NOT scale up - just use the weighted score directly
    let finalScore = totalWeightedScore
    let finalPercent = totalWeightedPercent

    // Normalize if weights don't add up to 1 (e.g. if user uses 55 instead of 0.55, or if they just don't sum to 1)
    if (totalUsedWeight > 0 && Math.abs(totalUsedWeight - 1.0) > 0.01) {
        // If weights are like 55 and 45 (sum > 1), we MUST normalize
        if (totalUsedWeight > 1.0) {
            console.log('[PREDICTION DEBUG] Weights sum > 1, normalizing by', totalUsedWeight)
            finalScore = totalWeightedScore / totalUsedWeight
            finalPercent = totalWeightedPercent / totalUsedWeight
        }
    }

    console.log('[PREDICTION DEBUG] Final score:', finalScore, 'Final Percent:', finalPercent)

    if (isHL) {
        // HL result is already in 1-7 scale
        return {
            grade: Math.round(finalScore),
            percentage: finalPercent,
            method: 'weighted-ib',
            details: `Weighted average of IB grades (HL logic)`
        }
    } else {
        // SL result is in 0-100 scale, round then convert to 1-7
        const roundedScore = Math.round(finalScore)
        const grade = convertPercentToIbGrade(roundedScore)
        return {
            grade,
            percentage: finalScore, // Use finalScore for SL as it matches the grade calculation
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

function estimatePercentFromIbGrade(grade: number, isHL: boolean = false): number {
    if (isHL) {
        // HL Boundaries from PLAN.md: 7 (98+), 6 (96+), 5 (90+), 4 (86+), 3 (76+), 2 (50+), 1 (<50)
        switch (grade) {
            case 7: return 99 // Midpoint of 98-100
            case 6: return 97 // Midpoint of 96-97
            case 5: return 93 // Midpoint of 90-95
            case 4: return 88 // Midpoint of 86-89
            case 3: return 81 // Midpoint of 76-85
            case 2: return 63 // Midpoint of 50-75
            case 1: return 25 // Midpoint of 0-49
            default: return 50
        }
    } else {
        // SL Boundaries from PLAN.md: 7 (96-100), 6 (90-95), 5 (86-89), 4 (76-85), 3 (70-75), 2 (50-69), 1 (0-49)
        switch (grade) {
            case 7: return 98 // Midpoint of 96-100
            case 6: return 93 // Midpoint of 90-95
            case 5: return 88 // Midpoint of 86-89
            case 4: return 81 // Midpoint of 76-85
            case 3: return 73 // Midpoint of 70-75
            case 2: return 60 // Midpoint of 50-69
            case 1: return 25 // Midpoint of 0-49
            default: return 50
        }
    }
}

function convertPercentToIbGrade(percent: number): number {
    // SL boundaries from PLAN.md
    if (percent >= 96) return 7  // 96-100
    if (percent >= 90) return 6  // 90-95
    if (percent >= 86) return 5  // 86-89
    if (percent >= 76) return 4  // 76-85
    if (percent >= 70) return 3  // 70-75
    if (percent >= 50) return 2  // 50-69
    return 1  // 0-49
}
