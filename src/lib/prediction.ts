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

    // If no categories are defined, fall back to simple average of points
    if (categories.length === 0) {
        let totalPercent = 0
        let validCount = 0

        for (const a of assessments) {
            let percent: number | null = null

            if (a.rawPercent !== null && a.rawPercent !== undefined) {
                percent = a.rawPercent
            } else if (a.rawGrade) {
                const match = a.rawGrade.match(/([\d.]+)\s*\/\s*([\d.]+)/)
                if (match && match.length === 3) {
                    percent = (parseFloat(match[1]) / parseFloat(match[2])) * 100
                }
            } else if (a.ibGrade !== null && a.ibGrade !== undefined) {
                // Last resort: estimate percent from IB grade
                percent = estimatePercentFromIbGrade(a.ibGrade, isHL)
            }

            if (percent !== null) {
                totalPercent += percent
                validCount++
            }
        }

        if (validCount === 0) return null

        const avgPercent = totalPercent / validCount
        const roundedPercent = Math.round(avgPercent)
        const grade = isHL ? estimateIbGradeFromPercent(roundedPercent) : convertPercentToIbGrade(roundedPercent)

        return {
            grade,
            percentage: avgPercent,
            method: 'simple-average',
            details: `Average of ${validCount} assessments (no categories)`
        }
    }

    const categoryWeights = normalizeWeights(categories)
    let totalWeightedScore = 0
    let totalUsedWeight = 0
    let breakdownParts: string[] = []

    // Calculate weighted score using points attained / points available
    for (const cat of categories) {
        const catAssessments = assessmentsByCategory[cat.id] || []
        const catWeight = categoryWeights[cat.id]

        if (catAssessments.length === 0) continue
        if (catWeight === 0) continue // 0-weight categories are not counted

        let catPointsAttained = 0
        let catPointsAvailable = 0
        let validAssessmentsWithPoints = 0
        let sumOfMaxPoints = 0

        // Pass 1: find average available points for tests that DO have explicit rawGrades
        for (const a of catAssessments) {
            if (a.rawGrade) {
                const match = a.rawGrade.match(/([\d.]+)\s*\/\s*([\d.]+)/)
                if (match && match.length === 3) {
                    sumOfMaxPoints += parseFloat(match[2])
                    validAssessmentsWithPoints++
                }
            }
        }
        
        // If we have some tests with points, use their average size for the unknown ones. If none, fall back to 10.
        const avgAvailablePoints = validAssessmentsWithPoints > 0 ? (sumOfMaxPoints / validAssessmentsWithPoints) : 10;
        let hasValidPoints = false

        // Pass 2: calculate sum using the dynamic fallback weight
        for (const a of catAssessments) {
            let attained = null
            let available = null

            if (a.rawPercent !== null && a.rawPercent !== undefined) {
                // Explicit percentage overrides fraction math. Pull the fraction denominator if available for weighting.
                let maxPoints = avgAvailablePoints;
                if (a.rawGrade) {
                    const match = a.rawGrade.match(/([\d.]+)\s*\/\s*([\d.]+)/);
                    if (match && match.length === 3) {
                        maxPoints = parseFloat(match[2]);
                    }
                }
                available = maxPoints;
                attained = (a.rawPercent / 100) * available;
            } else if (a.rawGrade) {
                const match = a.rawGrade.match(/([\d.]+)\s*\/\s*([\d.]+)/)
                if (match && match.length === 3) {
                    attained = parseFloat(match[1])
                    available = parseFloat(match[2])
                }
            }

            if (attained !== null && available !== null) {
                catPointsAttained += attained
                catPointsAvailable += available
                hasValidPoints = true
            }
        }

        if (hasValidPoints && catPointsAvailable > 0) {
            const catPercent = (catPointsAttained / catPointsAvailable) * 100
            totalWeightedScore += catPercent * catWeight
            totalUsedWeight += catWeight
            
            // Format: Tests (weight 55%): 92/95 = 96.8%
            breakdownParts.push(`${cat.name} (weight ${(catWeight * 100).toFixed(0)}%): ${catPointsAttained}/${catPointsAvailable} = ${catPercent.toFixed(1)}%`)
        }
    }

    if (totalUsedWeight === 0) return null

    // Normalize final percentage based on active weights
    const finalPercent = totalWeightedScore / totalUsedWeight
    const roundedPercent = Math.round(finalPercent)
    const grade = convertPercentToIbGrade(roundedPercent)

    // Complete the breakdown string
    breakdownParts.push(`Weighted Percentage: ${finalPercent.toFixed(1)}%`)
    breakdownParts.push(`Grade ${grade}`)

    return {
        grade,
        percentage: finalPercent,
        method: 'weighted-percent',
        details: breakdownParts.join(' • ')
    }
}

// Helpers

function estimateIbGradeFromPercent(percent: number): number {
    // HL Boundaries from PLAN.md: 7 (98+), 6 (96+), 5 (90+), 4 (86+), 3 (76+), 2 (50+), 1 (<50)
    if (percent >= 98) return 7
    if (percent >= 96) return 6
    if (percent >= 90) return 5
    if (percent >= 86) return 4
    if (percent >= 76) return 3
    if (percent >= 50) return 2
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
