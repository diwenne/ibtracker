export type SubjectType = 'HL' | 'SL';

export interface Assignment {
    id: string;
    name: string;
    ibGrade: number; // IB grade (1-7) - MANDATORY
    rawGrade?: string; // raw grade as fraction (e.g., "31/32")
    rawPercent?: number; // percentage (0-100)
    date: string;
}

export interface Subject {
    id: string;
    name: string;
    type: SubjectType;
    assignments: Assignment[];
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

export const calculatePercentage = (assignments: Assignment[], subjectType: SubjectType) => {
    if (assignments.length === 0) return 0;

    // Filter assignments that have either rawPercent or (for SL only) rawGrade
    const validAssignments = assignments.filter(a =>
        a.rawPercent !== undefined || (subjectType === 'SL' && a.rawGrade !== undefined)
    );

    if (validAssignments.length === 0) return 0;

    // Calculate weighted average based on available data
    let totalWeightedPercent = 0;
    let totalWeight = 0;

    validAssignments.forEach(assignment => {
        if (assignment.rawPercent !== undefined) {
            // Use raw percent directly, weighted by 100 (arbitrary weight)
            totalWeightedPercent += assignment.rawPercent * 100;
            totalWeight += 100;
        } else if (subjectType === 'SL' && assignment.rawGrade) {
            // Only auto-calculate from raw grade for SL (HL is scaled)
            const parsed = parseRawGrade(assignment.rawGrade);
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

// Calculate predicted grade from assignment IB grades (simple average)
export const calculatePredictedGrade = (assignments: Assignment[]): number => {
    if (assignments.length === 0) return 0;

    const totalGrade = assignments.reduce((sum, assignment) => sum + assignment.ibGrade, 0);
    return Math.round(totalGrade / assignments.length);
};
