"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Subject } from "@/lib/types";
import { GradeYearRanges, filterByGradeYear } from "@/lib/gradeYear";
import {
  Projection,
  RunningPoint,
  OfficialStanding,
  Standing,
  assessmentPercent,
  boundFor,
  computeStanding,
  officialStanding,
  projectNextAssessment,
  runningSeries,
} from "@/lib/insights";

// One accent hue (blue) in a few steps of the same ramp; validated as an ordinal pair in both modes
const ACCENT_FILL = "fill-[#2a78d6] dark:fill-[#3987e5]";
const ACCENT_STROKE = "stroke-[#2a78d6] dark:stroke-[#3987e5]";
const ACCENT_BG = "bg-[#2a78d6] dark:bg-[#3987e5]";
const SOFT_BG = "bg-[#86b6ef] dark:bg-[#184f95]";
const TRACK_BG = "bg-[#cde2fb] dark:bg-[#0d366b]";
const UP_TEXT = "text-[#006300] dark:text-[#0ca30c]";
const DOWN_TEXT = "text-[#d03b3b]";

const toDate = (iso: string) => {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDate = (iso: string, withYear = true) =>
  toDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
const floorTo = (v: number, step: number) => Math.floor(v / step) * step;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

// The percent at which a grade starts. Grades come from the rounded percent, except teacher-scaled ones.
const edgeFor = (standing: Standing, grade: number) => {
  const bound = boundFor(standing.bounds, grade);
  if (bound === null) return null;
  return standing.scaled ? bound : bound - 0.5;
};

// How hard the next grade up is: one assessment's required score, then multiple perfect scores, then out of reach
// Only meaningful when the grade is calculated from logged scores; report-card grades can't be projected.
const upgradeEffort = (i: SubjectInsight) => {
  if (!i.official || i.official.source !== 'calculated' || i.official.grade >= 7 || !i.projection) return Infinity;
  if (i.projection.needForNext !== null) return i.projection.needForNext;
  if (i.projection.perfectsNeeded !== null) return 100 + i.projection.perfectsNeeded;
  return 1000;
};

interface SubjectInsight {
  subject: Subject;
  // Calculated purely from logged scores
  standing: Standing | null;
  // The grade that counts: report card / teacher override when set, otherwise the calculated one
  official: OfficialStanding | null;
  projection: Projection | null;
  series: RunningPoint[];
  gr11: Standing | null;
  gr12: Standing | null;
  gapToNext: number | null;
  buffer: number | null;
  recent: { avg: number; delta: number } | null;
}

const buildInsight = (subject: Subject, ranges: GradeYearRanges): SubjectInsight => {
  const standing = computeStanding(subject, subject.assessments);
  const official = officialStanding(subject, standing);
  const series = runningSeries(subject, subject.assessments);

  let gapToNext: number | null = null;
  let buffer: number | null = null;
  if (official?.percentage !== null && official?.percentage !== undefined) {
    const nextEdge = edgeFor(official, official.grade + 1);
    const ownEdge = edgeFor(official, official.grade);
    if (nextEdge !== null) gapToNext = Math.max(0, nextEdge - official.percentage);
    if (ownEdge !== null) buffer = Math.max(0, official.percentage - ownEdge);
  }

  // Last three scores vs the average of every score in the subject
  const scores = series.map(p => p.score).filter((s): s is number => s !== null);
  const recent = scores.length >= 4
    ? { avg: mean(scores.slice(-3)), delta: mean(scores.slice(-3)) - mean(scores) }
    : null;

  return {
    subject,
    standing,
    official,
    projection: official?.source === 'calculated' ? projectNextAssessment(subject, subject.assessments) : null,
    series,
    gr11: computeStanding(subject, filterByGradeYear(subject.assessments, "11", ranges)),
    gr12: computeStanding(subject, filterByGradeYear(subject.assessments, "12", ranges)),
    gapToNext,
    buffer,
    recent,
  };
};

export function TrendsInsights({ subjects, gradeYearRanges, predictedTotal, maxPoints, averagePercent }: {
  subjects: Subject[];
  gradeYearRanges: GradeYearRanges;
  // Taken from the dashboard so both pages always agree (overrides, bonus points, tuning included)
  predictedTotal: number;
  maxPoints: number;
  averagePercent: number;
}) {
  const data = useMemo(() => {
    const regular = subjects.filter(s => !s.isCore && s.type !== "CORE").slice(0, 6);
    const insights = regular.map(s => buildInsight(s, gradeYearRanges));
    const withData = insights.filter(i => i.official);
    const reportCount = withData.filter(i => i.official!.source === 'report').length;

    // 30-day change only makes sense when every grade comes from logged scores (report-card grades have no history)
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return toIso(d); })();
    let totalDelta: number | null = null;
    if (reportCount === 0 && withData.length > 0) {
      const past = regular.map(s => computeStanding(s, s.assessments.filter(a => a.date.split("T")[0] <= cutoff)));
      if (past.every(Boolean)) {
        totalDelta = withData.reduce((sum, i) => sum + i.official!.grade, 0) - past.reduce((sum, st) => sum + st!.grade, 0);
      }
    }
    const allAssessments = regular.flatMap(s => s.assessments.map(a => ({ a, subject: s })));
    const gr12Count = allAssessments.filter(({ a }) => a.date.split("T")[0] >= gradeYearRanges.gr12Start).length;

    const easiest = insights
      .filter(i => upgradeEffort(i) < 1000)
      .sort((a, b) => upgradeEffort(a) - upgradeEffort(b))[0] ?? null;

    const scored = allAssessments
      .map(({ a, subject }) => ({ a, subject, pct: assessmentPercent(a) }))
      .filter((x): x is { a: typeof x.a; subject: Subject; pct: number } => x.pct !== null);
    const best = [...scored].sort((x, y) => y.pct - x.pct || y.a.date.localeCompare(x.a.date)).slice(0, 5);
    const toughest = [...scored].sort((x, y) => x.pct - y.pct || y.a.date.localeCompare(x.a.date)).slice(0, 3);

    const dates = allAssessments.map(({ a }) => a.date.split("T")[0]).sort();
    const today = toIso(new Date());
    const timeDomain: [string, string] | null = dates.length > 0
      ? [dates[0], dates[dates.length - 1] > today ? dates[dates.length - 1] : today]
      : null;

    return {
      insights,
      withData,
      reportCount,
      totalDelta,
      cutoff,
      assessmentCount: allAssessments.length,
      gr12Count,
      easiest,
      best,
      toughest,
      timeDomain,
    };
  }, [subjects, gradeYearRanges]);

  if (data.withData.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-24 text-sm">
        Log a few assessments and your trends will show up here.
      </div>
    );
  }

  // Easiest calculated upgrades first, then lowest grades, then the thinnest cushion
  const standingOrder = [...data.insights]
    .filter(i => i.official)
    .sort((a, b) => upgradeEffort(a) - upgradeEffort(b) || a.official!.grade - b.official!.grade || (a.buffer ?? 0) - (b.buffer ?? 0));
  const showYearCompare = data.insights.some(i => i.gr11) && data.insights.some(i => i.gr12);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Headline numbers */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Predicted total">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-semibold leading-none">{predictedTotal}</span>
            <span className="text-lg text-muted-foreground">/{maxPoints}</span>
          </div>
          <p className="text-xs mt-2">
            {data.reportCount > 0 ? (
              <span className="text-muted-foreground">
                {data.reportCount === data.withData.length ? "All" : `${data.reportCount} of ${data.withData.length}`} subjects from report card grades
              </span>
            ) : data.totalDelta === null || data.totalDelta === 0 ? (
              <span className="text-muted-foreground">No change since {fmtDate(data.cutoff, false)}</span>
            ) : (
              <span className={data.totalDelta > 0 ? UP_TEXT : DOWN_TEXT}>
                {data.totalDelta > 0 ? "▲" : "▼"} {Math.abs(data.totalDelta)} since {fmtDate(data.cutoff, false)}
              </span>
            )}
          </p>
        </StatTile>

        <StatTile label="Average">
          <span className="text-3xl font-semibold">{averagePercent.toFixed(1)}%</span>
          <p className="text-xs text-muted-foreground mt-2">Same as your dashboard</p>
        </StatTile>

        <StatTile label="Assessments logged">
          <span className="text-3xl font-semibold">{data.assessmentCount}</span>
          <p className="text-xs text-muted-foreground mt-2">{data.gr12Count} in Gr 12 so far</p>
        </StatTile>

        <StatTile label="Easiest upgrade">
          {data.easiest ? (
            <>
              <span className="text-2xl sm:text-3xl font-semibold truncate block">{data.easiest.subject.name}</span>
              <p className="text-xs text-muted-foreground mt-2">
                {data.easiest.projection!.needForNext !== null
                  ? `${data.easiest.projection!.needForNext.toFixed(1)}%+ next time for a ${data.easiest.projection!.nextGrade}`
                  : `${data.easiest.projection!.perfectsNeeded} perfect scores for a ${data.easiest.projection!.nextGrade}`}
              </p>
            </>
          ) : data.withData.every(i => i.official!.grade === 7) ? (
            <>
              <span className="text-3xl font-semibold">All 7s</span>
              <p className="text-xs text-muted-foreground mt-2">Nothing left to climb</p>
            </>
          ) : (
            <>
              <span className="text-3xl font-semibold">-</span>
              <p className="text-xs text-muted-foreground mt-2">
                {data.insights.some(i => i.official?.source === 'calculated' && i.official.grade < 7) ? "No quick wins right now" : "Your grades come from report cards"}
              </p>
            </>
          )}
        </StatTile>
      </section>

      {/* Distance to grade boundaries + what the next assessment needs */}
      <Card title="Where you stand" subtitle="Your official grade in each subject. Targets for the next assessment appear where the grade is calculated from your scores">
        <div className="divide-y divide-border/60">
          {standingOrder.map(i => <StandingRow key={i.subject.id} insight={i} />)}
        </div>
      </Card>

      {showYearCompare && (
        <Card title="Gr 11 → Gr 12" subtitle="Average of your logged scores in Gr 11 vs Gr 12 so far. Raw scores, not report card grades">
          <YearCompare insights={data.insights} />
        </Card>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Your logged scores over time</h2>
          <p className="text-xs text-muted-foreground">
            The line is the running average of your logged scores; dots are individual scores. Horizontal lines are where the app&apos;s own calculation would change grade.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.timeDomain && data.insights.filter(i => i.series.length > 0).map(i => (
            <RunningCard key={i.subject.id} insight={i} timeDomain={data.timeDomain!} gr12Start={gradeYearRanges.gr12Start} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Card title="Best results" subtitle="Your highest scores">
          <ResultList items={data.best} />
        </Card>
        <Card title="Toughest results" subtitle="Where marks slipped">
          <ResultList items={data.toughest} />
        </Card>
      </section>
    </div>
  );
}

function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 min-w-0">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      {children}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}

function StandingRow({ insight }: { insight: SubjectInsight }) {
  const { subject, standing: calculated, official: standing, projection, gapToNext, buffer } = insight;
  if (!standing) return null;
  const pct = standing.percentage;
  const isReport = standing.source === 'report';

  // Meter from the boundary below the current grade up to 100
  const ownBound = boundFor(standing.bounds, standing.grade) ?? 0;
  const lo = Math.max(0, Math.min(floorTo(ownBound - 4, 5), pct !== null ? floorTo(pct - 4, 5) : 100));
  const x = (v: number) => ((Math.min(100, Math.max(lo, v)) - lo) / (100 - lo)) * 100;
  const edges = [2, 3, 4, 5, 6, 7]
    .map(g => ({ grade: g, edge: edgeFor(standing, g) }))
    .filter((e): e is { grade: number; edge: number } => e.edge !== null && e.edge > lo && e.edge < 100);

  // What the next assessment can do: move up a grade, and how low it can go before dropping one
  const guidance: React.ReactNode[] = [];
  if (isReport && calculated) {
    // The logged scores rarely match how the teacher grades, so just show them side by side
    guidance.push(<>Your logged scores average {calculated.percentage !== null ? `${calculated.percentage.toFixed(1)}%` : "-"}, which the app would call a {calculated.grade}</>);
  }
  if (projection) {
    const next = projection.category ? `next ${projection.category.name} assessment` : "next assessment";
    if (projection.nextGrade && projection.needForNext !== null) {
      guidance.push(<>Score <strong className="text-foreground font-semibold">{projection.needForNext.toFixed(1)}%+</strong> on your {next} for a {projection.nextGrade}</>);
    } else if (projection.nextGrade && projection.perfectsNeeded !== null) {
      guidance.push(<>A {projection.nextGrade} takes about <strong className="text-foreground font-semibold">{projection.perfectsNeeded} perfect scores</strong> in a row</>);
    } else if (projection.nextGrade) {
      guidance.push(<>A {projection.nextGrade} is a long way off: more than 10 perfect scores</>);
    }
    if (standing.grade > 1) {
      guidance.push(projection.keepFloor > 0
        ? <>Below {projection.keepFloor.toFixed(1)}% drops you to a {standing.grade - 1}</>
        : <>Your {standing.grade} is safe on the {next}</>);
    }
  }

  return (
    <div className="py-3 grid gap-x-4 gap-y-2 grid-cols-[1fr_auto] sm:grid-cols-[130px_1fr_150px] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{subject.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {subject.type}{isReport ? " · report card" : standing.scaled && subject.teacher ? ` · ${subject.teacher} scale` : ""}
        </p>
      </div>

      <div className="col-span-2 sm:col-span-1 sm:order-none order-last">
        {pct === null ? (
          <p className="pt-1 text-xs text-muted-foreground">Add the report card % in the subject&apos;s settings to see how close you are to the next grade</p>
        ) : (
        <div className="relative pt-3.5" role="img" aria-label={`${subject.name}: ${pct?.toFixed(1) ?? "-"}%, grade ${standing.grade}`}>
          <div className={`relative h-2.5 rounded ${TRACK_BG}`}>
            {pct !== null && <div className={`absolute inset-y-0 left-0 rounded ${ACCENT_BG}`} style={{ width: `max(4px, ${x(pct)}%)` }} />}
            {/* Boundaries cut the bar as surface-colored gaps, labelled with the grade they start */}
            {edges.map(e => (
              <div key={e.grade} className="absolute -inset-y-px w-0.5 -translate-x-1/2 bg-card" style={{ left: `${x(e.edge)}%` }}>
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground">{e.grade}</span>
              </div>
            ))}
          </div>
        </div>
        )}
        {guidance.length > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {guidance.map((g, i) => <span key={i}>{i > 0 && " · "}{g}</span>)}
          </p>
        )}
      </div>

      <div className="text-xs text-muted-foreground text-right">
        <p className="text-sm">
          <span className="text-foreground font-semibold">Grade {standing.grade}</span>
          {pct !== null && <span className="text-foreground"> · {pct.toFixed(1)}%</span>}
        </p>
        <p>
          {pct === null ? "" : standing.scaled ? "teacher-scaled %" : standing.grade < 7 && gapToNext !== null
            ? `${gapToNext.toFixed(1)}% to a ${standing.grade + 1}`
            : buffer !== null ? `${buffer.toFixed(1)}% above the 7 line` : ""}
        </p>
      </div>
    </div>
  );
}

function YearCompare({ insights }: { insights: SubjectInsight[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const rows = insights.filter(i => i.gr11?.percentage != null || i.gr12?.percentage != null);
  const values = rows.flatMap(i => [i.gr11?.percentage, i.gr12?.percentage]).filter((v): v is number => v != null);
  const lo = Math.max(0, floorTo(Math.min(...values) - 3, 5));
  const x = (v: number) => ((v - lo) / (100 - lo)) * 100;
  const ticks: number[] = [];
  for (let t = lo; t <= 100; t += lo <= 60 ? 10 : 5) ticks.push(t);
  const cols = "grid grid-cols-[96px_1fr_84px] sm:grid-cols-[120px_1fr_110px] gap-x-3 items-center";

  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${SOFT_BG}`} />Gr 11</span>
        <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${ACCENT_BG}`} />Gr 12</span>
      </div>
      {rows.map(i => {
        const a = i.gr11?.percentage ?? null;
        const b = i.gr12?.percentage ?? null;
        const d = a !== null && b !== null ? b - a : null;
        return (
          <div key={i.subject.id} className={`${cols} h-9`}>
            <span className="text-sm truncate">{i.subject.name}</span>
            <div className="relative h-full">
              {ticks.map(t => (
                <div key={t} className="absolute inset-y-0 w-px bg-border" style={{ left: `${x(t)}%` }} />
              ))}
              {a !== null && b !== null && (
                <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground/40"
                  style={{ left: `${Math.min(x(a), x(b))}%`, width: `${Math.abs(x(b) - x(a))}%` }} />
              )}
              {([["Gr 11", i.gr11, SOFT_BG], ["Gr 12", i.gr12, ACCENT_BG]] as const).map(([year, st, bg]) => {
                if (st?.percentage == null) return null;
                const key = `${i.subject.id}-${year}`;
                return (
                  <div key={year} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-1.5 cursor-default"
                    style={{ left: `${x(st.percentage)}%` }}
                    onPointerEnter={() => setHover(key)} onPointerLeave={() => setHover(null)}>
                    <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-card ${bg}`} />
                    {hover === key && (
                      <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-sm whitespace-nowrap pointer-events-none">
                        <span className="font-semibold">{st.percentage.toFixed(1)}%</span>
                        <span className="text-muted-foreground"> · {year}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-right leading-tight">
              {b === null ? (
                <span className="text-muted-foreground">No Gr 12 yet</span>
              ) : a === null ? (
                <span className="text-muted-foreground">No Gr 11 scores</span>
              ) : (
                <>
                  <span className={Math.abs(d!) < 0.3 ? "text-muted-foreground" : d! > 0 ? UP_TEXT : DOWN_TEXT}>
                    {Math.abs(d!) < 0.3 ? "about the same" : `${d! > 0 ? "▲" : "▼"} ${Math.abs(d!).toFixed(1)}%`}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
      <div className={cols}>
        <span />
        <div className="relative h-4">
          {ticks.map(t => (
            <span key={t} className="absolute top-0.5 -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums" style={{ left: `${x(t)}%` }}>{t}%</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

function RunningCard({ insight, timeDomain, gr12Start }: { insight: SubjectInsight; timeDomain: [string, string]; gr12Start: string }) {
  const { subject, series, standing, recent } = insight;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  if (!standing) return null;

  // Teacher-scaled percentages aren't on the same scale as raw scores, so don't mix them on one axis
  const showScores = !standing.scaled;
  const W = 320;
  const H = 140;
  const pad = { l: 4, r: 18, t: 14, b: 20 };
  const t0 = toDate(timeDomain[0]).getTime();
  const t1 = Math.max(toDate(timeDomain[1]).getTime(), t0 + 86400000);
  const x = (iso: string) => pad.l + ((toDate(iso).getTime() - t0) / (t1 - t0)) * (W - pad.l - pad.r);

  const values = series.flatMap(p => [p.running, showScores ? p.score : null]).filter((v): v is number => v !== null);
  const lo = Math.max(0, Math.min(95, floorTo(Math.min(...values) - 2, 5)));
  const hi = Math.max(100, Math.ceil(Math.max(...values)));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);

  const linePts = series.filter(p => p.running !== null);
  const path = linePts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.date).toFixed(1)} ${y(p.running!).toFixed(1)}`).join(" ");
  const edges = [2, 3, 4, 5, 6, 7]
    .map(g => ({ grade: g, edge: edgeFor(standing, g) }))
    .filter((e): e is { grade: number; edge: number } => e.edge !== null && e.edge > lo && e.edge < hi);

  // Month ticks, thinned to at most 4 labels
  const monthTicks: string[] = [];
  const cur = new Date(toDate(timeDomain[0]).getFullYear(), toDate(timeDomain[0]).getMonth() + 1, 1);
  while (cur.getTime() <= t1) { monthTicks.push(toIso(cur)); cur.setMonth(cur.getMonth() + 1); }
  const stepEvery = Math.max(1, Math.ceil(monthTicks.length / 4));
  const shownTicks = monthTicks.filter((_, i) => i % stepEvery === 0);
  const gr12X = gr12Start > timeDomain[0] && gr12Start < timeDomain[1] ? x(gr12Start) : null;

  const hovered = hoverIdx !== null ? series[hoverIdx] : null;

  const handleMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    series.forEach((p, i) => { if (Math.abs(x(p.date) - px) < Math.abs(x(series[best].date) - px)) best = i; });
    setHoverIdx(best);
  };
  const handleKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setHoverIdx(i => Math.min(series.length - 1, (i ?? -1) + 1));
    if (e.key === "ArrowLeft") setHoverIdx(i => Math.max(0, (i ?? series.length) - 1));
    if (e.key === "Escape") setHoverIdx(null);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{subject.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {series.length} assessments{standing.scaled ? " · teacher-scaled %" : ""}
            {insight.official?.source === 'report' && ` · report card ${insight.official.grade}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{standing.percentage !== null ? `${standing.percentage.toFixed(1)}%` : "-"} <span className="text-[11px] font-normal text-muted-foreground">avg</span></p>
          {recent && (
            <p className={`text-[11px] ${Math.abs(recent.delta) < 0.5 ? "text-muted-foreground" : recent.delta > 0 ? UP_TEXT : DOWN_TEXT}`}>
              Last 3: {recent.avg.toFixed(0)}% {Math.abs(recent.delta) < 0.5 ? "· on par" : `${recent.delta > 0 ? "▲" : "▼"} ${Math.abs(recent.delta).toFixed(1)} vs avg`}
            </p>
          )}
        </div>
      </div>

      <div className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          tabIndex={0} onKeyDown={handleKey} onBlur={() => setHoverIdx(null)} role="img"
          aria-label={`${subject.name} running average, currently ${standing.percentage?.toFixed(1) ?? "-"}%`}>
          {edges.map(e => (
            <g key={e.grade}>
              <line x1={pad.l} x2={W - pad.r} y1={y(e.edge)} y2={y(e.edge)} className="stroke-border" strokeWidth={1} />
              <text x={W - pad.r + 4} y={y(e.edge) + 3} className="fill-muted-foreground text-[9px]">{e.grade}</text>
            </g>
          ))}
          <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="stroke-border" strokeWidth={1} />
          {shownTicks.map(t => (
            <text key={t} x={x(t)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {toDate(t).toLocaleDateString("en-US", { month: "short" })}
            </text>
          ))}
          <text x={pad.l} y={pad.t - 4} className="fill-muted-foreground/70 text-[9px]">{lo}–{hi}%</text>
          {gr12X !== null && (
            <g>
              <line x1={gr12X} x2={gr12X} y1={pad.t} y2={H - pad.b} className="stroke-muted-foreground/40" strokeWidth={1} />
              <text x={gr12X + 3} y={pad.t + 8} className="fill-muted-foreground text-[9px]">Gr 12</text>
            </g>
          )}

          {showScores && series.map((p, i) => p.score !== null && (
            <circle key={i} cx={x(p.date)} cy={y(Math.min(hi, Math.max(lo, p.score)))} r={3}
              className={`fill-muted-foreground/45 stroke-card ${hoverIdx === i ? "fill-foreground" : ""}`} strokeWidth={1.5} />
          ))}
          <path d={path} fill="none" className={ACCENT_STROKE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {linePts.length > 0 && (
            <circle cx={x(linePts[linePts.length - 1].date)} cy={y(linePts[linePts.length - 1].running!)} r={4}
              className={`${ACCENT_FILL} stroke-card`} strokeWidth={2} />
          )}

          {hovered && (
            <g pointerEvents="none">
              <line x1={x(hovered.date)} x2={x(hovered.date)} y1={pad.t} y2={H - pad.b} className="stroke-foreground/30" strokeWidth={1} />
              {hovered.running !== null && (
                <circle cx={x(hovered.date)} cy={y(hovered.running)} r={4} className={`${ACCENT_FILL} stroke-card`} strokeWidth={2} />
              )}
            </g>
          )}
          <rect x={0} y={0} width={W} height={H} fill="transparent" onPointerMove={handleMove} onPointerLeave={() => setHoverIdx(null)} />
        </svg>

        {hovered && (
          <div className="absolute z-10 pointer-events-none rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-sm whitespace-nowrap"
            style={{
              left: `${(x(hovered.date) / W) * 100}%`,
              top: 0,
              transform: `translateX(${x(hovered.date) > W * 0.6 ? "calc(-100% - 8px)" : "8px"})`,
            }}>
            <p className="text-muted-foreground">{fmtDate(hovered.date)}</p>
            <p className="font-medium max-w-[180px] truncate">{hovered.name}</p>
            {showScores && hovered.score !== null && <p><span className="font-semibold">{hovered.score.toFixed(1)}%</span> <span className="text-muted-foreground">score</span></p>}
            {hovered.running !== null && <p><span className="font-semibold">{hovered.running.toFixed(1)}%</span> <span className="text-muted-foreground">average after · grade {hovered.grade}</span></p>}
          </div>
        )}
      </div>

      <button type="button" onClick={() => setShowTable(v => !v)}
        className="mt-1 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 bg-transparent border-none p-0 cursor-pointer">
        {showTable ? "Hide data" : "Show data"}
      </button>
      {showTable && (
        <table className="mt-2 w-full text-[11px] tabular-nums">
          <thead className="text-muted-foreground">
            <tr><th className="text-left font-normal">Date</th><th className="text-left font-normal">Assessment</th><th className="text-right font-normal">Score</th><th className="text-right font-normal">Avg</th></tr>
          </thead>
          <tbody>
            {[...series].reverse().map((p, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="py-0.5 pr-2 whitespace-nowrap">{fmtDate(p.date, false)}</td>
                <td className="py-0.5 pr-2 truncate max-w-[120px]">{p.name}</td>
                <td className="py-0.5 text-right">{p.score !== null ? `${p.score.toFixed(0)}%` : "-"}</td>
                <td className="py-0.5 text-right">{p.running !== null ? `${p.running.toFixed(1)}%` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ResultList({ items }: { items: Array<{ a: { id: string; name: string; date: string }; subject: Subject; pct: number }> }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">No scored assessments yet</p>;
  return (
    <ol className="space-y-2">
      {items.map(({ a, subject, pct }) => (
        <li key={a.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm truncate">{a.name}</p>
            <p className="text-[11px] text-muted-foreground">{subject.name} · {fmtDate(a.date)}</p>
          </div>
          <span className="text-sm font-semibold tabular-nums shrink-0">{pct.toFixed(1)}%</span>
        </li>
      ))}
    </ol>
  );
}
