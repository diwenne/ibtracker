// Teacher-specific configuration for grade tracking

import { Assessment, Subject, parseRawGrade } from './types';

export interface TeacherCategory {
    name: string;
    weight: number; // 0 < weight <= 1
}

export interface GradeCalculationResult {
    grade: number;
    percentage: number;
    explanation: string;
}

export interface TeacherConfig {
    id: string;
    displayName: string;
    categories: TeacherCategory[];
    note: string; // Special instructions or requirements for this teacher
    calculateGrade?: (subject: Subject, assessments: Assessment[]) => GradeCalculationResult | null;
}

// Greenwood's grade calculation algorithm
function calculateGreenwoodGrade(subject: Subject, assessments: Assessment[]): GradeCalculationResult | null {
    const categories = subject.categories || [];
    const testsCategory = categories.find(c => c.name === 'Tests');
    const labsCategory = categories.find(c => c.name === 'Labs');

    if (!testsCategory || !labsCategory) {
        return null;
    }

    // Calculate raw grade for Tests
    const testAssessments = assessments.filter(a => a.categoryId === testsCategory.id);
    let testsTotalScore = 0;
    let testsTotalMax = 0;

    for (const assessment of testAssessments) {
        if (assessment.rawGrade) {
            const parsed = parseRawGrade(assessment.rawGrade);
            if (parsed) {
                testsTotalScore += parsed.score;
                testsTotalMax += parsed.total;
            }
        }
    }

    // Calculate raw grade for Labs
    const labAssessments = assessments.filter(a => a.categoryId === labsCategory.id);
    let labsTotalScore = 0;
    let labsTotalMax = 0;

    for (const assessment of labAssessments) {
        if (assessment.rawGrade) {
            const parsed = parseRawGrade(assessment.rawGrade);
            if (parsed) {
                labsTotalScore += parsed.score;
                labsTotalMax += parsed.total;
            }
        }
    }

    // Check if we have enough data
    if (testsTotalMax === 0 && labsTotalMax === 0) {
        return null;
    }

    // Calculate raw percentages
    // If no assessments in a category, assume 100% to avoid penalizing students
    const testsRawPercent = testsTotalMax > 0 ? (testsTotalScore / testsTotalMax) * 100 : 100;
    const labsRawPercent = labsTotalMax > 0 ? (labsTotalScore / labsTotalMax) * 100 : 100;

    // Calculate weighted raw percentage (0.8 + 0.18 = 0.98, 2% discarded)
    const rawPercentage = (testsRawPercent * 0.8) + (labsRawPercent * 0.18);

    // Determine IB grade based on raw percentage and scale adjusted percentage within range
    let ibGrade: number;
    let adjustedPercent: number;

    if (rawPercentage >= 80) {
        // Grade 7: 80%+ raw maps to 98-100% adjusted
        ibGrade = 7;
        const rangePosition = Math.min((rawPercentage - 80) / 20, 1); // 0 to 1 within the range
        adjustedPercent = 98 + (rangePosition * 2); // 98% to 100%
    } else if (rawPercentage >= 73) {
        // Grade 6: 73-79% raw maps to 96-98% adjusted
        ibGrade = 6;
        const rangePosition = (rawPercentage - 73) / 7; // 0 to 1 within the range
        adjustedPercent = 96 + (rangePosition * 2); // 96% to 98%
    } else if (rawPercentage >= 60) {
        // Grade 5: 60-72% raw maps to 90-96% adjusted
        ibGrade = 5;
        const rangePosition = (rawPercentage - 60) / 13; // 0 to 1 within the range
        adjustedPercent = 90 + (rangePosition * 6); // 90% to 96%
    } else if (rawPercentage >= 50) {
        // Grade 4: 50-59% raw maps to 86-90% adjusted
        ibGrade = 4;
        const rangePosition = (rawPercentage - 50) / 10; // 0 to 1 within the range
        adjustedPercent = 86 + (rangePosition * 4); // 86% to 90%
    } else if (rawPercentage >= 40) {
        // Grade 3: 40-49% raw maps to 76-86% adjusted
        ibGrade = 3;
        const rangePosition = (rawPercentage - 40) / 10; // 0 to 1 within the range
        adjustedPercent = 76 + (rangePosition * 10); // 76% to 86%
    } else if (rawPercentage >= 30) {
        // Grade 2: 30-39% raw maps to 50-76% adjusted
        ibGrade = 2;
        const rangePosition = (rawPercentage - 30) / 10; // 0 to 1 within the range
        adjustedPercent = 50 + (rangePosition * 26); // 50% to 76%
    } else {
        // Grade 1: <30% raw maps to <50% adjusted (direct mapping)
        ibGrade = 1;
        adjustedPercent = Math.min(rawPercentage * 1.5, 49); // Scale up a bit but cap at 49%
    }

    // Build explanation (without revealing exact weights)
    const explanation = [
        `Tests: ${testsTotalScore}/${testsTotalMax} = ${testsRawPercent.toFixed(1)}%`,
        `Labs: ${labsTotalScore}/${labsTotalMax} = ${labsRawPercent.toFixed(1)}%`,
        `Weighted Average: ${rawPercentage.toFixed(1)}%`,
        `Grade ${ibGrade} (Adjusted: ${adjustedPercent.toFixed(3)}%)`
    ].join(' • ');

    return {
        grade: ibGrade,
        percentage: adjustedPercent,
        explanation
    };
}

// All available teachers
export const TEACHERS: Record<string, TeacherConfig> = {
    Greenwood: {
        id: 'Greenwood',
        displayName: 'Greenwood (PMSS; Physics)',
        categories: [
            { name: 'Tests', weight: 0.8 },
            { name: 'Labs', weight: 0.2 }
        ],
        note: 'Only raw score (e.g., 31/33) is required. Other fields are not used in the calculation.',
        calculateGrade: calculateGreenwoodGrade
    }
    // Add more teachers here in the future
};

// Helper to get teacher config
export function getTeacherConfig(teacherId: string | null): TeacherConfig | null {
    if (!teacherId) return null;
    return TEACHERS[teacherId] || null;
}

// Helper to check if a teacher exists
export function isValidTeacher(teacherId: string | null): boolean {
    if (!teacherId) return true; // null is valid (general algorithm)
    return teacherId in TEACHERS;
}

// Get list of all teachers for UI
export function getAllTeachers(): TeacherConfig[] {
    return Object.values(TEACHERS);
}
