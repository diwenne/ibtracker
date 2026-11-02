import { Assessment, Category, Subject, calculatePercentage, calculatePredictedGrade, getGrade, parseRawGrade } from "./types";
import { calculateLocalPrediction } from "./prediction";
import { getTeacherConfig } from "./teachers";

// Lower bound (inclusive, on the rounded percent) for grades 2..7.
// These mirror the tables in prediction.ts / teachers.ts so the charts line up with the grades the app shows.
const SL_BOUNDS = [50, 70, 76, 86, 90, 96];
const HL_BOUNDS = [50, 76, 86, 90, 96, 98];

export interface Standing {
    grade: number;
    percentage: number | null;
    // Lower bounds for grades 2..7 that this percentage is measured against
    bounds: number[];
    // Teacher algorithms report an adjusted percent, not the raw average of scores
    scaled: boolean;
}

// Same priority as the subject card: teacher algorithm > local weighted calc > simple IB grade average
export const computeStanding = (subject: Subject, assessments: Assessment[]): Standing | null => {
    if (assessments.length === 0) return null;

    const teacher = getTeacherConfig(subject.teacher || null);
    const teacherCalc = teacher?.calculateGrade ? teacher.calculateGrade(subject, assessments) : null;
    if (teacherCalc) {
        return { grade: teacherCalc.grade, percentage: teacherCalc.percentage, bounds: HL_BOUNDS, scaled: true };
    }

    const categories = subject.categories || [];
    const local = calculateLocalPrediction(subject, assessments, categories);
    if (local) {
        const bounds = categories.length === 0 && subject.type === 'HL' ? HL_BOUNDS : SL_BOUNDS;
        return { grade: local.grade, percentage: local.percentage ?? null, bounds, scaled: false };
    }

    const grade = calculatePredictedGrade(assessments);
    if (!grade) return null;
    const pct = calculatePercentage(assessments, subject.type);
    return { grade, percentage: pct > 0 ? pct : null, bounds: SL_BOUNDS, scaled: false };
};

export interface OfficialStanding extends Standing {
    // 'report' = grade/percent entered manually (report card or teacher predicted); 'calculated' = from logged scores
    source: 'report' | 'calculated';
}

// The grade that actually counts, same priority as the subject card: manual grade > manual percent > calculated
export const officialStanding = (subject: Subject, calculated: Standing | null): OfficialStanding | null => {
    const typeBounds = subject.type === 'HL' ? HL_BOUNDS : SL_BOUNDS;
    const manualPercent = subject.manualPercent ?? null;
    if (subject.overrideGrade !== null && subject.overrideGrade !== undefined) {
        return { grade: subject.overrideGrade, percentage: manualPercent, bounds: typeBounds, scaled: false, source: 'report' };
    }
    if (manualPercent !== null) {
        return { grade: getGrade(manualPercent, subject.type), percentage: manualPercent, bounds: typeBounds, scaled: false, source: 'report' };
    }
    return calculated ? { ...calculated, source: 'calculated' } : null;
};

export const boundFor = (bounds: number[], grade: number): number | null =>
    grade >= 2 && grade <= 7 ? bounds[grade - 2] : null;

// The score an individual assessment earned, as a percent
export const assessmentPercent = (a: Assessment): number | null => {
    if (a.rawPercent !== null && a.rawPercent !== undefined) return a.rawPercent;
    if (a.rawGrade) {
        const parsed = parseRawGrade(a.rawGrade);
        if (parsed) return (parsed.score / parsed.total) * 100;
    }
    return null;
};

const byDate = (a: Assessment, b: Assessment) => a.date.localeCompare(b.date);

export interface RunningPoint {
    date: string;
    name: string;
    score: number | null;
    running: number | null;
    grade: number;
}

// Subject percentage after each assessment, in date order
export const runningSeries = (subject: Subject, assessments: Assessment[]): RunningPoint[] => {
    const sorted = [...assessments].sort(byDate);
    const points: RunningPoint[] = [];
    sorted.forEach((a, i) => {
        const standing = computeStanding(subject, sorted.slice(0, i + 1));
        if (!standing) return;
        points.push({
            date: a.date.split('T')[0],
            name: a.name,
            score: assessmentPercent(a),
            running: standing.percentage,
            grade: standing.grade,
        });
    });
    return points;
};

// The category a "typical next assessment" would land in: the heaviest one that's already in use
const pickProjectionCategory = (subject: Subject, assessments: Assessment[]): Category | null => {
    const categories = (subject.categories || []).filter(c => c.rawWeight > 0);
    if (categories.length === 0) return null;
    const used = categories.filter(c => assessments.some(a => a.categoryId === c.id));
    const pool = used.length > 0 ? used : categories;
    return [...pool].sort((a, b) => b.rawWeight - a.rawWeight)[0];
};

export interface Projection {
    category: Category | null;
    nextGrade: number | null;
    // Lowest score on the next assessment that reaches nextGrade (null = not reachable in one go)
    needForNext: number | null;
    // When one assessment isn't enough: how many perfect scores in a row it would take (null = more than 10)
    perfectsNeeded: number | null;
    // Lowest score on the next assessment that keeps the current grade
    keepFloor: number;
}

export const projectNextAssessment = (subject: Subject, assessments: Assessment[]): Projection | null => {
    const current = computeStanding(subject, assessments);
    if (!current) return null;

    const category = pickProjectionCategory(subject, assessments);
    const sameKind = assessments.filter(a => (category ? a.categoryId === category.id : true));
    const totals = sameKind
        .map(a => (a.rawGrade ? parseRawGrade(a.rawGrade)?.total : undefined))
        .filter((t): t is number => t !== undefined);
    const typicalTotal = totals.length > 0 ? totals.reduce((s, t) => s + t, 0) / totals.length : 100;

    const gradeWith = (score: number, count = 1) => {
        const hypotheticals: Assessment[] = Array.from({ length: count }, (_, i) => ({
            id: `__projection_${i}__`,
            name: 'Next assessment',
            ibGrade: null,
            rawPercent: score,
            rawGrade: `${((score / 100) * typicalTotal).toFixed(3)}/${typicalTotal}`,
            date: new Date().toISOString().split('T')[0],
            categoryId: category?.id ?? null,
        }));
        return computeStanding(subject, [...assessments, ...hypotheticals])?.grade ?? 0;
    };

    // Grade only goes up as the score goes up, so binary search for the threshold
    const minScoreFor = (target: number): number | null => {
        if (gradeWith(100) < target) return null;
        if (gradeWith(0) >= target) return 0;
        let lo = 0;
        let hi = 100;
        for (let i = 0; i < 30; i++) {
            const mid = (lo + hi) / 2;
            if (gradeWith(mid) >= target) hi = mid; else lo = mid;
        }
        return Math.ceil(hi * 10) / 10;
    };

    const nextGrade = current.grade < 7 ? current.grade + 1 : null;
    const needForNext = nextGrade ? minScoreFor(nextGrade) : null;
    let perfectsNeeded: number | null = null;
    if (nextGrade && needForNext === null) {
        for (let k = 2; k <= 10; k++) {
            if (gradeWith(100, k) >= nextGrade) { perfectsNeeded = k; break; }
        }
    }
    return {
        category,
        nextGrade,
        needForNext,
        perfectsNeeded,
        keepFloor: minScoreFor(current.grade) ?? 0,
    };
};
