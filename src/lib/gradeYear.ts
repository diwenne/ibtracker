import { Assessment } from "./types";

export type GradeYearFilter = 'all' | '11' | '12';

// Both dates are inclusive start dates (YYYY-MM-DD). Gr 11 runs from gr11Start up to
// (but not including) gr12Start; Gr 12 runs from gr12Start onward.
export interface GradeYearRanges {
    gr11Start: string;
    gr12Start: string;
}

// Gr 11 = Sep of last school year through July, Gr 12 = everything from August onward.
export const defaultGradeYearRanges = (today: Date = new Date()): GradeYearRanges => {
    const year = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
    return { gr11Start: `${year - 1}-09-01`, gr12Start: `${year}-08-01` };
};

export const getAssessmentGradeYear = (date: string, ranges: GradeYearRanges): '11' | '12' | null => {
    const day = date.split('T')[0];
    if (day >= ranges.gr12Start) return '12';
    if (day >= ranges.gr11Start) return '11';
    return null;
};

export const filterByGradeYear = (
    assessments: Assessment[],
    filter: GradeYearFilter,
    ranges: GradeYearRanges
): Assessment[] => {
    if (filter === 'all') return assessments;
    return assessments.filter(a => getAssessmentGradeYear(a.date, ranges) === filter);
};

export const isValidGradeYearRanges = (value: unknown): value is GradeYearRanges => {
    const r = value as GradeYearRanges;
    return !!r && /^\d{4}-\d{2}-\d{2}$/.test(r.gr11Start) && /^\d{4}-\d{2}-\d{2}$/.test(r.gr12Start);
};
