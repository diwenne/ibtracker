export type SubjectType = 'HL' | 'SL';

export interface Category {
    id: string;
    name: string;
    rawWeight: number;
}

export interface Feedback {
    id: string;
    userId: string;
    userEmail: string | null;
    content: string;
    type: 'feedback' | 'feature';
    createdAt: string;
}

export interface Assessment {
    id: string;
    name: string;
    ibGrade: number | null; // IB grade (1-7) - Now optional for SL if raw percent exists
    rawGrade?: string | null; // raw grade as fraction (e.g., "31/32")
    rawPercent?: number | null; // percentage (0-100)
    date: string;
    notes?: string | null; // optional notes about the assessment
    categoryId?: string | null;
}

export interface Subject {
    id: string;
    name: string;
    type: SubjectType;
    assessments: Assessment[];
    categories: Category[];
    aiPredictedGrade?: number | null;
    aiExplanation?: string | null;
    predictionDirty?: boolean;
    teacher?: string | null;
}

// Helper to parse raw grade fraction like "31/32"
export const parseRawGrade = (rawGrade: string): { score: number; total: number } | null => {
    const parts = rawGrade.trim().split('/');
    if (parts.length !== 2) return null;
    const score = parseFloat(parts[0]);
    const total = parseFloat(parts[1]);
    if (isNaN(score) || isNaN(total) || total === 0) return null;
    return { score, total };
};

export const calculatePercentage = (assessments: Assessment[], subjectType: SubjectType) => {
    if (assessments.length === 0) return 0;

    // Filter assessments that have either rawPercent or (for SL only) rawGrade
    const validAssessments = assessments.filter(a =>
        (a.rawPercent !== undefined && a.rawPercent !== null) || (subjectType === 'SL' && a.rawGrade !== undefined && a.rawGrade !== null)
    );

    if (validAssessments.length === 0) return 0;

    // Calculate weighted average based on available data
    let totalWeightedPercent = 0;
    let totalWeight = 0;

    validAssessments.forEach(assessment => {
        if (assessment.rawPercent !== undefined && assessment.rawPercent !== null) {
            // Use raw percent directly, weighted by 100 (arbitrary weight)
            totalWeightedPercent += assessment.rawPercent * 100;
            totalWeight += 100;
        } else if (subjectType === 'SL' && assessment.rawGrade) {
            // Only auto-calculate from raw grade for SL (HL is scaled)
            const parsed = parseRawGrade(assessment.rawGrade);
            if (parsed && parsed.total > 0) {
                // Calculate percent from score/total
                const percent = (parsed.score / parsed.total) * 100;
                totalWeightedPercent += percent * parsed.total;
                totalWeight += parsed.total;
            }
        }
    });

    if (totalWeight === 0) return 0;
    return totalWeightedPercent / totalWeight;
};

export const getGrade = (percentage: number, type: SubjectType): number => {
    const p = Math.round(percentage);

    if (type === 'HL') {
        if (p >= 98) return 7;
        if (p >= 96) return 6;
        if (p >= 90) return 5;
        if (p >= 86) return 4;
        if (p >= 76) return 3;
        if (p >= 50) return 2;
        return 1;
    } else {
        if (p >= 96) return 7;
        if (p >= 90) return 6;
        if (p >= 86) return 5;
        if (p >= 76) return 4;
        if (p >= 70) return 3;
        if (p >= 50) return 2;
        return 1;
    }
};

// Helper function to calculate percentage from raw grade
export const calculateRawPercent = (score: number, total: number): number => {
    if (total === 0) return 0;
    return (score / total) * 100;
};

// Helper function to convert percentage to IB grade
export const percentToIBGrade = (percent: number, type: SubjectType): number => {
    return getGrade(percent, type);
};

// Calculate predicted grade from assessment IB grades (simple average)
export const calculatePredictedGrade = (assessments: Assessment[]): number => {
    const validAssessments = assessments.filter(a => a.ibGrade !== null && a.ibGrade !== undefined);
    if (validAssessments.length === 0) return 0;

    const totalGrade = validAssessments.reduce((sum, assessment) => sum + (assessment.ibGrade || 0), 0);
    return Math.round(totalGrade / validAssessments.length);
};
