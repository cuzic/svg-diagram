import type { TimelineBand, TimelineOpts, NumericTimelineBand, NumericTimelineOpts, GanttBand, GanttOpts, GanttRow } from '../types/timeline.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
type GanttIds<R extends readonly GanttRow[]> = Extract<(R[number] extends infer T ? T extends {
    readonly id: infer I;
} ? I : never : never), string>;
/**
 * A schedule: rows of tasks (bars), milestones (diamonds) and `{section}` headings on a date axis. Dates are 'YYYY-MM-DD',
 * `end` is the last day; `after` draws a dependency arrow; `today` (always written out) draws a line.
 *   gantt([{section: '設計'}, {id: 'spec', label: '仕様', start: '2026-10-05', end: '2026-10-16', progress: 1},
 *          {label: '実装', start: '2026-10-19', days: 14, after: 'spec'}, {label: 'リリース', start: '2026-11-13', milestone: true}], {today: '2026-10-12'})
 */
export declare function gantt<const R extends readonly GanttRow[], const Id extends string = never>(rows: R, opts?: GanttOpts & {
    id?: Id;
}): GanttBand & Declares<Id | GanttIds<R>> & HandleOf<Id> & AnchorsOf<GanttIds<R>>;
/**
 * A horizontal time axis with a deadline: the axis (`from` - `to`), today (`now`), the deadline and the span between them
 * ("あと 1 年 3 か月"), plus optional marks. Dates are 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'; `now` is always written out, never read from the clock.
 */
/** A numeric axis (`unit: 'ms'`, `from: 0`, `to: 700`) with lanes, events (dots with labels) and spans (bars, or dimension lines with `dim: true`). */
export declare function timeline<const Id extends string = never>(opts: NumericTimelineOpts & {
    id?: Id;
}): NumericTimelineBand & Declares<Id> & HandleOf<Id>;
export declare function timeline<const Id extends string = never>(opts: TimelineOpts & {
    id?: Id;
}): TimelineBand & Declares<Id> & HandleOf<Id>;
export {};
