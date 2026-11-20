// gantt(): a schedule. Rows are tasks (bars on a date axis), milestones (diamonds) and section headings; the axis, the
// ticks, today's line and the dependency arrows are computed. Dates are 'YYYY-MM-DD' (an end is inclusive); `today` is
// always written out, never read from the clock.
import {GANTT_AXIS, LEGEND as GANTT_LEGEND, partStep} from './parts.ts';
import {textWidth} from './atoms.ts';
import type {Pt} from './graph-layout.ts';
import {ticksOf, timelineDay} from './timeline.ts';
import type {FontFamily, Roles, WidthOf} from './types/core.ts';
import type {GanttBand, GanttRow, GanttTask, GanttText, LaidOutGantt} from './types/timeline.ts';

import {must} from './must.ts';
const ROW_H0 = 32, BAR_H0 = 18, HEAD_H0 = 44, PAD0 = 8, ACT_ROW_H0 = 44, LANE_H0 = 14, LEGEND_H0 = 24, LABEL_MAX = 0.4, MS_DAY = 86400000, ARROW = 8;

/** Drops repeated points and the middle point of three on a line. */
const simplifyPts = (pts: Pt[]): Pt[] => {
  const o: Pt[] = [];
  for (const p of pts) if (!o.length || Math.abs(must(o[o.length - 1]).x - p.x) > 0.01 || Math.abs(must(o[o.length - 1]).y - p.y) > 0.01) o.push(p);
  return o.filter((p, i) => i === 0 || i === o.length - 1 || !((must(o[i - 1]).x === p.x && p.x === must(o[i + 1]).x) || (must(o[i - 1]).y === p.y && p.y === must(o[i + 1]).y)));
};

const isSection = (r: GanttRow): r is {section: string} => 'section' in r;
const tasksOf = (band: GanttBand): GanttTask[] => band.rows.filter((r): r is GanttTask => !isSection(r));

const fmtDay = (day: number): string => { const d = new Date(day * MS_DAY); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const dayOf = (v: string, what: string): number => {
  if (v === 'auto' && what === 'today') throw new Error(`gantt(): ${what}: 'auto' needs a date from the build (--today YYYY-MM-DD, SVG_DIAGRAM_TODAY or .svg-diagram.json \"today\"); it was not given one here`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new Error(`gantt(): ${what} must be 'YYYY-MM-DD' (got ${JSON.stringify(v)})`);
  try { return timelineDay(v, what); } catch { throw new Error(`gantt(): ${what} is not a real date (${v})`); }
};

/** [start, end) of a task in days; a milestone is the one day `start`. `field` names the dates in the messages ('actual.' for an actual). */
export function spanOf(t: Pick<GanttTask, 'label' | 'start' | 'end' | 'days' | 'milestone'>, field = ''): [number, number] {
  const s = dayOf(t.start, `"${t.label}" ${field}start`);
  if (t.milestone) {
    if (t.end !== undefined || t.days !== undefined) throw new Error(`gantt(): "${t.label}" is a milestone (one day): drop ${field}end / ${field}days`);
    return [s, s + 1];
  }
  if (t.end !== undefined && t.days !== undefined) throw new Error(`gantt(): "${t.label}" has both ${field}end and ${field}days; use one`);
  if (t.days !== undefined) {
    if (!(Number.isInteger(t.days) && t.days >= 1)) throw new Error(`gantt(): "${t.label}" ${field}days must be a whole number >= 1 (got ${t.days})`);
    return [s, s + t.days];
  }
  if (t.end === undefined) throw new Error(`gantt(): "${t.label}" needs end or days (or milestone: true)`);
  const e = dayOf(t.end, `"${t.label}" ${field}end`);
  if (e < s) throw new Error(`gantt(): "${t.label}" ${field}ends (${t.end}) before it starts (${t.start})`);
  return [s, e + 1];
}

/** The axis in days: [from, to) — the given range, else the first start to the last end. */
function axisOf(band: GanttBand, spans: [number, number][]): [number, number] {
  let from = band.from !== undefined ? dayOf(band.from, 'from') : Math.min(...spans.map(s => s[0]));
  let to = band.to !== undefined ? dayOf(band.to, 'to') + 1 : Math.max(...spans.map(s => s[1]));
  // extendToToday widens only the side that was not written out (an explicit from / to is the author's intent)
  if (band.extendToToday && band.today !== undefined) {
    const today = dayOf(band.today, 'today');
    if (band.from === undefined && today < from) from = today;
    if (band.to === undefined && today >= to) to = today + 1;
  }
  return [from, to];
}
/** A day number back to 'YYYY-MM-DD'. */
const ymd = (day: number): string => new Date(day * MS_DAY).toISOString().slice(0, 10);
const SHORT_AXIS = 140; // days: up to this the ticks are weeks, above it months
const mondays = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let d = from + ((8 - new Date(from * MS_DAY).getUTCDay()) % 7); d < to; d += 7) out.push(d);
  return out;
};

/** What a task did (ADR 0068 D4b): its days [start, end), and whether it is still running (then it ends after today). */
export interface GanttActual {span: [number, number]; open: boolean}
/** A gantt's input, checked, in days: the work the layout (svg, pptx) and the Excel export share (ADR 0068 D1). */
export interface GanttModel {tasks: GanttTask[]; spans: Map<GanttTask, [number, number]>; actuals: Map<GanttTask, GanttActual>; from: number; to: number; today?: number}

const PLAN_WORD = '予定', ACTUAL_WORD = '実績';

/** Checks a gantt's input and works out its days. Throws the error a gantt() with this input would. */
export function ganttModel(band: GanttBand): GanttModel {
  const tasks = tasksOf(band);
  if (!tasks.length) throw new Error('gantt(rows) needs at least one task');
  const ids = new Map<string, GanttTask>();
  for (const t of tasks) {
    if (typeof t.label !== 'string' || !t.label.trim()) throw new Error('gantt(): every task needs a label');
    if (t.progress !== undefined && !(t.progress >= 0 && t.progress <= 1)) throw new Error(`gantt(): "${t.label}" progress must be between 0 and 1 (got ${t.progress})`);
    if (t.id !== undefined) { if (ids.has(t.id)) throw new Error(`gantt(): duplicate task id "${t.id}"`); ids.set(t.id, t); }
  }
  const spans = new Map<GanttTask, [number, number]>(tasks.map(t => [t, spanOf(t)]));
  for (const t of tasks) for (const a of [t.after ?? []].flat()) {
    if (!ids.has(a)) throw new Error(`gantt(): "${t.label}" is after unknown task id "${a}"`);
    if (ids.get(a) === t) throw new Error(`gantt(): "${t.label}" is after itself`);
  }
  // a task cannot come (transitively) after itself
  const visiting = new Set<GanttTask>(), done = new Set<GanttTask>();
  const visit = (t: GanttTask): void => {
    if (done.has(t)) return;
    if (visiting.has(t)) throw new Error(`gantt(): "${t.label}" is part of a cycle of after (a task cannot wait for itself)`);
    visiting.add(t);
    for (const a of [t.after ?? []].flat()) visit(must(ids.get(a)));
    visiting.delete(t); done.add(t);
  };
  tasks.forEach(visit);
  const today = band.today !== undefined ? dayOf(band.today, 'today') : undefined;
  // ADR 0068 D4b: the actuals
  const actuals = new Map<GanttTask, GanttActual>();
  for (const t of tasks) {
    if (t.actual === undefined) continue;
    if (band.actual !== true) throw new Error(`gantt(): "${t.label}" has an actual: give the gantt actual: true (it then draws the plan and the actual of every task)`);
    const a = t.actual;
    if (a === null || typeof a !== 'object' || Array.isArray(a)) throw new Error(`gantt(): "${t.label}" actual must be {start, end?} (got ${JSON.stringify(a)})`);
    const open = !t.milestone && a.end === undefined && a.days === undefined;
    if (open) {
      const s = dayOf(a.start, `"${t.label}" actual.start`);
      if (today === undefined) throw new Error(`gantt(): "${t.label}" is in progress (its actual has no end): give the gantt today, to draw it up to`);
      if (s > today) throw new Error(`gantt(): "${t.label}" actual.start (${a.start}) is after today (${band.today})`);
      actuals.set(t, {span: [s, today + 1], open: true});
      continue;
    }
    const span = spanOf({label: t.label, start: a.start, ...(a.end === undefined ? {} : {end: a.end}), ...(a.days === undefined ? {} : {days: a.days}), ...(t.milestone ? {milestone: true} : {})}, 'actual.');
    if (today !== undefined && span[1] - 1 > today) throw new Error(`gantt(): "${t.label}" actual ends (${ymd(span[1] - 1)}) after today (${band.today}): leave the end out while it is in progress`);
    actuals.set(t, {span, open: false});
  }
  if (band.actual === true) for (const t of tasks) if (t.progress !== undefined) throw new Error(`gantt(): "${t.label}" has progress, but a gantt with actual: true shows how far a task got by its actual bar: drop progress`);
  const [from, to] = axisOf(band, [...spans.values(), ...[...actuals.values()].map(a => a.span)]);
  if (!(from < to)) throw new Error('gantt(): from must be before to');
  for (const [t, [s, e]] of spans) if (s < from || e > to) throw new Error(`gantt(): "${t.label}" (${t.start}${t.end ? ` - ${t.end}` : ''}) is outside the axis (from / to)`);
  for (const [t, {span: [s, e]}] of actuals) if (s < from || e > to) throw new Error(`gantt(): "${t.label}" actual (${ymd(s)} - ${ymd(e - 1)}) is outside the axis (from / to)`);
  if (today !== undefined && (today < from || today >= to)) throw new Error(`gantt(): today (${band.today}) is outside the axis (${ymd(from)} - ${ymd(to - 1)}): move today into it, set from / to, or pass extendToToday: true`);
  return {tasks, spans, actuals, from, to, ...(today === undefined ? {} : {today})};
}

export function ganttTexts(band: GanttBand, roles: Roles): [string, number, number, FontFamily][] {
  const S = roles.note, out: [string, number, number, FontFamily][] = [[band.todayLabel ?? '今日', S, 700, 'sans']];
  for (const r of band.rows) out.push([isSection(r) ? r.section : r.label, S, isSection(r) ? 700 : 400, 'sans']);
  if (band.actual === true) out.push([PLAN_WORD, S, 400, 'sans'], [ACTUAL_WORD, S, 400, 'sans']);
  // every label the axis may draw (the layout picks among them by width): all weeks' dates, or the month ticks
  if (tasksOf(band).length) {
    const {from, to} = ganttModel(band);
    if (to - from <= SHORT_AXIS) { out.push(['12/31', S, 400, 'sans'], [fmtDay(from), S, 400, 'sans']); for (const d of mondays(from, to)) out.push([fmtDay(d), S, 400, 'sans']); }
    else for (const t of ticksOf(from, to)) out.push([t.label, S, 400, 'sans']);
  }
  return out;
}

/** `geom` multiplies the row, bar and header heights and the padding: 1 keeps them at their 14px values; a canvas passes its font scale, so the header holds both the tick dates and today's label. */
export function layoutGantt(band: GanttBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, geom = 1): LaidOutGantt {
  const S = roles.note, two = band.actual === true;
  const ROW_H = Math.round(ROW_H0 * geom), BAR_H = Math.round(BAR_H0 * geom), HEAD_H = Math.round(HEAD_H0 * geom), PAD = Math.round(PAD0 * geom);
  // two rows per task (ADR 0068 D4b): a taller task row, the plan lane over the actual lane, a legend strip under the chart
  const TASK_H = two ? Math.round(ACT_ROW_H0 * geom) : ROW_H, LANE_H = Math.round(LANE_H0 * geom), LEGEND_H = two ? Math.round(LEGEND_H0 * geom) : 0;
  const {tasks, spans, actuals, from, to, today} = ganttModel(band);

  const labelW = Math.max(...band.rows.map(r => Math.ceil(textWidth(widthOf, isSection(r) ? r.section : r.label, S, isSection(r) ? 700 : 400)))) + 2 * PAD;
  const maxLabel = Math.floor(w * LABEL_MAX);
  if (labelW > maxLabel) throw new Error(`gantt(): the longest row label needs ${labelW}px but only ${maxLabel}px of the ${Math.round(w)}px figure is for labels (shorten it)`);
  const plotL = x + labelW + PAD, plotR = x + w - PAD - 12; // a margin: the diamond of a milestone on the last day sticks out of its day
  if (plotR - plotL < 240) throw new Error('gantt(): the chart area is too narrow (240px at least)');
  const px = (day: number): number => plotL + (day - from) / (to - from) * (plotR - plotL);
  const top = y + HEAD_H;
  // the rows, stacked: a section keeps the one-row height, a task is taller when it has two lanes
  const rows: {y: number; h: number}[] = [];
  for (const r of band.rows) { const ry = rows.length ? must(rows[rows.length - 1]).y + must(rows[rows.length - 1]).h : top; rows.push({y: ry, h: isSection(r) ? ROW_H : TASK_H}); }
  const plotB = rows.length ? must(rows[rows.length - 1]).y + must(rows[rows.length - 1]).h : top;
  const height = plotB - y + PAD + LEGEND_H;
  const out: LaidOutGantt = {
    type: 'gantt', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: height,
    plot: {x1: plotL, x2: plotR, y1: top, y2: plotB}, ticks: [], rows, sections: [], bars: [], actuals: [], deps: [], texts: [], anchors: [], labelBoxes: [],
  };
  const textOf = (s: string, tx: number, ty: number, anchor: 'start' | 'middle', bold = false, muted = false, tone?: 'danger', part?: string): GanttText => {
    const tw = textWidth(widthOf, s, S, bold ? 700 : 400);
    out.labelBoxes.push({label: s, x: anchor === 'middle' ? tx - tw / 2 : tx, y: ty - S, w: tw, h: S + 4});
    return {text: s, x: tx, y: ty, size: S, bold, muted, anchor, ...(tone ? {tone} : {}), ...(part ? {part} : {})};
  };
  const text = (...a: Parameters<typeof textOf>): void => { out.texts.push(textOf(...a)); };

  // ticks: weeks (every n-th Monday) for short axes, else months
  const span = to - from, perDay = (plotR - plotL) / span;
  const tickDays: {day: number; label: string}[] = [];
  if (span <= SHORT_AXIS) {
    const widest = textWidth(widthOf, '12/31', S, 400) + 12;
    const every = Math.max(1, Math.ceil(widest / (7 * perDay)));
    const days = mondays(from, to);
    if (!days.length) tickDays.push({day: from, label: fmtDay(from)}); // a short axis with no Monday: at least its first day
    for (let k = 0; k < days.length; k += every) tickDays.push({day: must(days[k]), label: fmtDay(must(days[k]))});
  } else tickDays.push(...ticksOf(from, to));
  for (const t of tickDays) {
    const tx = px(t.day);
    out.ticks.push({x: tx});
    const tw = textWidth(widthOf, t.label, S, 400);
    if (tx + tw / 2 <= x + w) text(t.label, Math.max(tx, plotL), y + S + 2, 'middle', false, true, undefined, GANTT_AXIS);
  }

  // ADR 0054 D9.2: a section is its name and the tasks under it (its pale strip lies under the grid lines, so it stays out)
  let section: string | undefined;
  const barAt = (s: number, e: number, cy: number, h: number): {x: number; y: number; w: number; h: number} => ({x: px(s), y: cy - h / 2, w: Math.max(4, px(e) - px(s)), h});
  const diamondAt = (s: number, cy: number, h: number): {x: number; y: number; w: number; h: number} => { const hh = h / 2 + 2; return {x: px(s) + perDay / 2 - hh, y: cy - hh, w: 2 * hh, h: 2 * hh}; };
  band.rows.forEach((r, i) => {
    const row = must(rows[i]), ry = row.y, cy = ry + row.h / 2;
    if (isSection(r)) {
      section = partStep('section', i, r.section);
      out.sections.push({x, y: ry, w, h: row.h, part: section});
      text(r.section, x + PAD, cy + S / 2 - 1, 'start', true, false, undefined, section);
      return;
    }
    const task = partStep('task', r.id ?? i, r.label), part = section ? `${section}/${task}` : task;
    const [s, e] = must(spans.get(r));
    text(r.label, x + PAD, cy + S / 2 - 1, 'start', false, false, undefined, part);
    // two lanes: the plan's centre a lane above the row's middle, the actual's a lane below (a gap of a sixth of a lane between them)
    const gap = Math.round(LANE_H / 3), planCy = two ? cy - (LANE_H + gap) / 2 : cy, actCy = cy + (LANE_H + gap) / 2, barH = two ? LANE_H : BAR_H;
    const tone = r.tone ?? 'accent';
    const rect = r.milestone ? diamondAt(s, planCy, barH) : barAt(s, e, planCy, barH);
    out.bars.push({...rect, tone, label: r.label, ...(r.milestone ? {milestone: true} : {}), ...(r.progress === undefined ? {} : {progress: r.progress}), ...(two ? {plan: true as const} : {}), part});
    if (r.id) out.anchors.push({id: r.id, ...rect});
    const a = actuals.get(r);
    if (a) {
      const [as, ae] = a.span, task = out.bars.length - 1;
      if (r.milestone) out.actuals.push({...diamondAt(as, actCy, barH), task, tone, milestone: true, part});
      else {
        // in progress: up to today's line (the middle of today), not the end of the day the model counts to
        const end = a.open && today !== undefined ? px(today) + perDay / 2 : px(ae);
        out.actuals.push({x: px(as), y: actCy - barH / 2, w: Math.max(4, end - px(as)), h: barH, task, tone, ...(a.open ? {open: true as const} : {}), part});
      }
    }
  });
  const rectOf = (t: GanttTask) => must(out.bars[tasks.indexOf(t)]);
  const rowOf = (t: GanttTask): number => band.rows.indexOf(t);
  const obstacles = [...out.bars, ...out.actuals];
  for (const t of tasks) for (const a of [t.after ?? []].flat()) {
    const tail = must(ids(tasks).get(a)), p = rectOf(tail), q = rectOf(t);
    const x1 = p.x + p.w, y1 = p.y + p.h / 2, x2 = q.x, y2 = q.y + q.h / 2;
    const ends = new Set<object>([p, q]);
    const between = obstacles.filter(b => !ends.has(b) && b.y + b.h > Math.min(y1, y2) && b.y < Math.max(y1, y2));
    const free = (c: number): boolean => !between.some(b => c >= b.x - 4 && c <= b.x + b.w + 4);
    const tailRow = rowOf(tail), headRow = rowOf(t), down = headRow > tailRow;
    let pts: Pt[] | undefined;
    // 1) straight on: out of the tail, down (or up) in the first free column before the head, into the head
    for (let c = x1 + 8; c <= x2 - ARROW - 6 && !pts; c += 6) if (free(c)) pts = [{x: x1, y: y1}, {x: c, y: y1}, {x: c, y: y2}, {x: x2, y: y2}];
    // 2) along the line between rows (no bar sits on it): out of the tail to the line below (above) its row, along it to a column free of
    //    the bars of the rows between, to the line beside the head's row, along it to just before the head, into it
    if (!pts) {
      const edge = (k: number, below: boolean): number => { const r = must(rows[k]); return below ? r.y + r.h : r.y; };
      const bT = edge(tailRow, down), bH = edge(headRow, !down);
      const lo = out.plot.x1 + 4, hi = out.plot.x2 - 4;
      const cols = bT === bH ? [x1 + 8] : Array.from({length: Math.floor((hi - lo) / 6) + 1}, (_, k) => lo + k * 6).filter(free).sort((u, v) => Math.abs(u - (x1 + x2) / 2) - Math.abs(v - (x1 + x2) / 2));
      if (!cols.length) cols.push(x1 + 8); // nothing is free (verify will say which bar): still a route that ends on the head
      // out of the tail's row and into the head's in a column clear of that row's other lane (an actual that runs on past its plan,
      // ADR 0068 D4b): the first such column right of the tail, and the last left of the head
      const clear = (c: number, ya: number, yb: number): boolean => !obstacles.some(b => b !== p && b !== q && b.y + b.h > Math.min(ya, yb) && b.y < Math.max(ya, yb) && c >= b.x - 4 && c <= b.x + b.w + 4);
      let out1 = x1 + 8, in1 = x2 - 8;
      while (out1 < hi && !clear(out1, y1, bT)) out1 += 6;
      while (in1 > lo && !clear(in1, bH, y2)) in1 -= 6;
      pts = [{x: x1, y: y1}, {x: out1, y: y1}, {x: out1, y: bT}, {x: must(cols[0]), y: bT}, {x: must(cols[0]), y: bH}, {x: in1, y: bH}, {x: in1, y: y2}, {x: x2, y: y2}];
    }
    out.deps.push({from: tasks.indexOf(tail), to: tasks.indexOf(t), points: simplifyPts(pts)});
  }
  if (today !== undefined) {
    const tx = px(today) + perDay / 2;
    const tl = band.todayLabel ?? '今日', tw = textWidth(widthOf, tl, S, 700), part = partStep('today', 0, tl);
    out.today = {x: tx, y1: top, y2: out.plot.y2, part};
    text(tl, Math.min(Math.max(tx, x + tw / 2), x + w - tw / 2), y + HEAD_H - 4, 'middle', true, false, 'danger', part);
  }
  if (two) {
    // the legend under the chart, from its left edge: a pale plan swatch and its word, then a solid actual swatch and its word
    const cy = plotB + PAD / 2 + LEGEND_H / 2, sw = Math.round(24 * geom), swatches: NonNullable<LaidOutGantt['legend']>['swatches'] = [], texts: GanttText[] = [];
    let lx = x + PAD;
    for (const [kind, word] of [['plan', PLAN_WORD], ['actual', ACTUAL_WORD]] as const) {
      swatches.push({x: lx, y: cy - LANE_H / 2, w: sw, h: LANE_H, kind});
      texts.push(textOf(word, lx + sw + 6, cy + S / 2 - 1, 'start', false, false, undefined, GANTT_LEGEND));
      lx += sw + 6 + textWidth(widthOf, word, S, 400) + 16;
    }
    out.legend = {swatches, texts, part: GANTT_LEGEND};
  }
  return out;
}

const ids = (tasks: GanttTask[]): Map<string, GanttTask> => new Map(tasks.flatMap(t => t.id === undefined ? [] : [[t.id, t] as const]));
