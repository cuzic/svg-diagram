import {timelineDay} from '../timeline.ts';
import {num} from '../qc.ts';
import type {TimelineBand, TimelineOpts, NumericTimelineBand, NumericTimelineOpts, GanttBand, GanttOpts, GanttRow} from '../types/timeline.ts';
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
  const band: GanttBand = {type: 'gantt', rows: [...rows], ...(opts.from === undefined ? {} : {from: opts.from}), ...(opts.to === undefined ? {} : {to: opts.to}), ...(opts.today === undefined ? {} : {today: opts.today}), ...(opts.todayLabel === undefined ? {} : {todayLabel: opts.todayLabel}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, 'gantt()'), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), rows.map(r => 'id' in r ? r.id : undefined));
}
/**
 * A horizontal time axis with a deadline: the axis (`from` - `to`), today (`now`), the deadline and the span between them
 * ("あと 1 年 3 か月"), plus optional marks. Dates are 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'; `now` is always written out, never read from the clock.
 */
/** A numeric axis (`unit: 'ms'`, `from: 0`, `to: 700`) with lanes, events (dots with labels) and spans (bars, or dimension lines with `dim: true`). */
export function timeline<const Id extends string = never>(opts: NumericTimelineOpts & {id?: Id}): NumericTimelineBand & Declares<Id> & HandleOf<Id>;
export function timeline<const Id extends string = never>(opts: TimelineOpts & {id?: Id}): TimelineBand & Declares<Id> & HandleOf<Id>;
export function timeline(arg: TimelineOpts | NumericTimelineOpts): TimelineBand | NumericTimelineBand {
  if (typeof arg?.from === 'number' || 'unit' in (arg ?? {})) return numericTimeline(arg as NumericTimelineOpts);
  const opts = arg as TimelineOpts;
  const day = (v: unknown, what: string): number => timelineDay(v as string, what);
  const from = day(opts?.from, 'from'), to = day(opts?.to, 'to');
  if (!(from < to)) throw new Error(`timeline(): from (${opts.from}) must be before to (${opts.to})`);
  for (const [k, v] of [['now', opts.now], ['deadline', opts.deadline]] as const) {
    if (!v || typeof v !== 'object') throw new Error(`timeline(): ${k} is required (${k === 'now' ? "{at: '2026-10'}" : "{at: '2027-03', label: 'サポート終了'}"})`);
    const t = day(v.at, `${k}.at`);
    if (t < from || t > to) throw new Error(`timeline(): ${k}.at (${v.at}) is outside the axis (${opts.from} - ${opts.to})`);
  }
  if (opts.deadline.line !== undefined && opts.deadline.line !== 'full') throw new Error(`timeline(): deadline.line must be 'full' (got ${String(opts.deadline.line)})`);
  if (opts.span !== undefined && opts.span !== 'bar' && opts.span !== 'fill') throw new Error(`timeline(): span must be 'bar' or 'fill' (got ${String(opts.span)})`);
  if (opts.now.label !== undefined && (typeof opts.now.label !== 'string' || !opts.now.label.trim())) throw new Error('timeline(): now.label must not be empty (leave it out for "現在")');
  if (typeof opts.deadline.label !== 'string' || !opts.deadline.label.trim()) throw new Error('timeline(): deadline.label is required');
  for (const [i, m] of (opts.marks ?? []).entries()) {
    const t = day(m.at, `marks[${i}].at`);
    if (t < from || t > to) throw new Error(`timeline(): marks[${i}].at (${m.at}) is outside the axis (${opts.from} - ${opts.to})`);
    if (typeof m.label !== 'string' || !m.label.trim()) throw new Error(`timeline(): marks[${i}].label is required`);
    if (m.tone !== undefined && !['accent', 'danger', 'muted'].includes(m.tone)) throw new Error(`timeline(): marks[${i}].tone must be accent, danger or muted (got ${m.tone})`);
  }
  if (opts.remaining !== undefined && opts.remaining !== false && (typeof opts.remaining !== 'string' || !opts.remaining.trim())) throw new Error('timeline(): remaining must be a string or false');
  return withHandle({type: 'timeline', from: opts.from, to: opts.to, now: opts.now, deadline: opts.deadline, ...(opts.span === undefined ? {} : {span: opts.span}), ...(opts.marks ? {marks: opts.marks} : {}), ...(opts.remaining === undefined ? {} : {remaining: opts.remaining}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)}, opts.id);
}
function numericTimeline(o: NumericTimelineOpts): NumericTimelineBand {
  const num = (v: unknown, what: string): number => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`timeline(): ${what} must be a number (got ${JSON.stringify(v)})`); return v; };
  if (typeof o.unit !== 'string') throw new Error("timeline(): unit is required for a numeric axis ('ms', 's', ...; '' for none)");
  const from = num(o.from, 'from'), to = num(o.to, 'to');
  if (!(from < to)) throw new Error(`timeline(): from (${from}) must be less than to (${to})`);
  if (o.step !== undefined && !(num(o.step, 'step') > 0 && (to - from) / o.step <= 40)) throw new Error('timeline(): step must be > 0 and give at most 40 ticks');
  const lanes = o.lanes ?? [];
  if (o.lanes !== undefined && (!Array.isArray(lanes) || !lanes.length || lanes.some(l => typeof l !== 'string' || !l.trim()) || new Set(lanes).size !== lanes.length)) throw new Error('timeline(): lanes must be a list of distinct, non-empty names');
  const tones = ['accent', 'danger', 'muted'];
  const laneOk = (l: string | undefined, what: string) => { if (l !== undefined && !lanes.includes(l)) throw new Error(`timeline(): ${what}.lane "${l}" is not one of lanes (${lanes.join(', ') || 'none declared'})`); };
  (o.events ?? []).forEach((e, i) => {
    const at = num(e?.at, `events[${i}].at`);
    if (at < from || at > to) throw new Error(`timeline(): events[${i}].at (${at}) is outside the axis (${from} - ${to})`);
    if (typeof e.label !== 'string' || !e.label.trim()) throw new Error(`timeline(): events[${i}].label is required`);
    if (e.tone !== undefined && !tones.includes(e.tone)) throw new Error(`timeline(): events[${i}].tone must be accent, danger or muted (got ${e.tone})`);
    laneOk(e.lane, `events[${i}]`);
  });
  (o.spans ?? []).forEach((sp, i) => {
    const a = num(sp?.from, `spans[${i}].from`), b = num(sp?.to, `spans[${i}].to`);
    if (!(a < b)) throw new Error(`timeline(): spans[${i}].from (${a}) must be less than to (${b})`);
    if (a < from || b > to) throw new Error(`timeline(): spans[${i}] (${a} - ${b}) is outside the axis (${from} - ${to})`);
    if (sp.tone !== undefined && !tones.includes(sp.tone)) throw new Error(`timeline(): spans[${i}].tone must be accent, danger or muted (got ${sp.tone})`);
    if (sp.label !== undefined && (typeof sp.label !== 'string' || !sp.label.trim())) throw new Error(`timeline(): spans[${i}].label must not be empty`);
    laneOk(sp.lane, `spans[${i}]`);
  });
  return withHandle({type: 'timeline', unit: o.unit, from, to, ...(o.step === undefined ? {} : {step: o.step}), ...(o.lanes ? {lanes: o.lanes} : {}), ...(o.events ? {events: o.events} : {}), ...(o.spans ? {spans: o.spans} : {}), ...(o.id === undefined ? {} : {id: o.id}), ...revealOf(o)}, o.id);
}
