import type { GanttBand, GanttOpts, GanttRow } from '../types/timeline.ts';
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
export {};
