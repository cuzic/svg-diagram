import type {GanttBand, GanttOpts, GanttRow} from '../types/timeline.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {revealOf, scopeOpt, withAnchors, withHandle} from './shared.ts';

type GanttIds<R extends readonly GanttRow[]> = Extract<(R[number] extends infer T ? T extends {readonly id: infer I} ? I : never : never), string>;
/**
 * A schedule: rows of tasks (bars), milestones (diamonds) and `{section}` headings on a date axis. Dates are 'YYYY-MM-DD',
 * `end` is the last day; `after` draws a dependency arrow; `today` (always written out) draws a line.
 *   gantt([{section: '設計'}, {id: 'spec', label: '仕様', start: '2026-10-05', end: '2026-10-16', progress: 1},
 *          {label: '実装', start: '2026-10-19', days: 14, after: 'spec'}, {label: 'リリース', start: '2026-11-13', milestone: true}], {today: '2026-10-12'})
 */
export function gantt<const R extends readonly GanttRow[], const Id extends string = never>(rows: R, opts?: GanttOpts & {id?: Id}): GanttBand & Declares<Id | GanttIds<R>> & HandleOf<Id> & AnchorsOf<GanttIds<R>>;
export function gantt(rows: readonly GanttRow[], opts: GanttOpts = {}): GanttBand {
  if (!Array.isArray(rows) || !rows.some(r => !('section' in r))) throw new Error('gantt(rows) needs at least one task');
  for (const r of rows) {
    if ('section' in r) { if (typeof r.section !== 'string' || !r.section.trim()) throw new Error('gantt(): a section needs a title'); continue; }
    if (r.tone !== undefined && !['accent', 'danger', 'muted'].includes(r.tone)) throw new Error(`gantt(): "${r.label}" tone must be accent, danger or muted (got ${String(r.tone)})`);
  }
  const band: GanttBand = {type: 'gantt', rows: [...rows], ...(opts.from === undefined ? {} : {from: opts.from}), ...(opts.to === undefined ? {} : {to: opts.to}), ...(opts.today === undefined ? {} : {today: opts.today}), ...(opts.todayLabel === undefined ? {} : {todayLabel: opts.todayLabel}), ...(opts.extendToToday === undefined ? {} : {extendToToday: opts.extendToToday}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, 'gantt()'), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), rows.map(r => 'id' in r ? r.id : undefined));
}
