// gantt(): a schedule. Rows are tasks (bars on a date axis), milestones (diamonds) and section headings; the axis, the
// ticks, today's line and the dependency arrows are computed. Dates are 'YYYY-MM-DD' (an end is inclusive); `today` is
// always written out, never read from the clock.
import {textWidth} from './atoms.ts';
import type {Pt} from './graph-layout.ts';
import {ticksOf, timelineDay} from './timeline.ts';
import type {FontFamily, Roles, WidthOf} from './types/core.ts';
import type {GanttBand, GanttRow, GanttTask, LaidOutGantt} from './types/timeline.ts';

const ROW_H = 32, BAR_H = 18, HEAD_H = 44, PAD = 8, LABEL_MAX = 0.4, MS_DAY = 86400000, ARROW = 8;

/** Drops repeated points and the middle point of three on a line. */
const simplifyPts = (pts: Pt[]): Pt[] => {
  const o: Pt[] = [];
  for (const p of pts) if (!o.length || Math.abs(o[o.length - 1].x - p.x) > 0.01 || Math.abs(o[o.length - 1].y - p.y) > 0.01) o.push(p);
  return o.filter((p, i) => i === 0 || i === o.length - 1 || !((o[i - 1].x === p.x && p.x === o[i + 1].x) || (o[i - 1].y === p.y && p.y === o[i + 1].y)));
};

const isSection = (r: GanttRow): r is {section: string} => 'section' in r;
const tasksOf = (band: GanttBand): GanttTask[] => band.rows.filter((r): r is GanttTask => !isSection(r));

const fmtDay = (day: number): string => { const d = new Date(day * MS_DAY); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const dayOf = (v: string, what: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new Error(`gantt(): ${what} must be 'YYYY-MM-DD' (got ${JSON.stringify(v)})`);
  try { return timelineDay(v, what); } catch { throw new Error(`gantt(): ${what} is not a real date (${v})`); }
};

/** [start, end) of a task in days; a milestone is the one day `start`. */
export function spanOf(t: GanttTask): [number, number] {
  const s = dayOf(t.start, `"${t.label}" start`);
  if (t.milestone) {
    if (t.end !== undefined || t.days !== undefined) throw new Error(`gantt(): "${t.label}" is a milestone (one day): drop end / days`);
    return [s, s + 1];
  }
  if (t.end !== undefined && t.days !== undefined) throw new Error(`gantt(): "${t.label}" has both end and days; use one`);
  if (t.days !== undefined) {
    if (!(Number.isInteger(t.days) && t.days >= 1)) throw new Error(`gantt(): "${t.label}" days must be a whole number >= 1 (got ${t.days})`);
    return [s, s + t.days];
  }
  if (t.end === undefined) throw new Error(`gantt(): "${t.label}" needs end or days (or milestone: true)`);
  const e = dayOf(t.end, `"${t.label}" end`);
  if (e < s) throw new Error(`gantt(): "${t.label}" ends (${t.end}) before it starts (${t.start})`);
  return [s, e + 1];
}

/** The axis in days: [from, to) — the given range, else the first start to the last end. */
function axisOf(band: GanttBand, spans: [number, number][]): [number, number] {
  const from = band.from !== undefined ? dayOf(band.from, 'from') : Math.min(...spans.map(s => s[0]));
  const to = band.to !== undefined ? dayOf(band.to, 'to') + 1 : Math.max(...spans.map(s => s[1]));
  return [from, to];
}
const SHORT_AXIS = 140; // days: up to this the ticks are weeks, above it months
const mondays = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let d = from + ((8 - new Date(from * MS_DAY).getUTCDay()) % 7); d < to; d += 7) out.push(d);
  return out;
};

export function ganttTexts(band: GanttBand, roles: Roles): [string, number, number, FontFamily][] {
  const S = roles.note, out: [string, number, number, FontFamily][] = [[band.todayLabel ?? '今日', S, 700, 'sans']];
  for (const r of band.rows) out.push([isSection(r) ? r.section : r.label, S, isSection(r) ? 700 : 400, 'sans']);
  // every label the axis may draw (the layout picks among them by width): all weeks' dates, or the month ticks
  const tasks = tasksOf(band);
  if (tasks.length) {
    const [from, to] = axisOf(band, tasks.map(spanOf));
    if (to - from <= SHORT_AXIS) { out.push(['12/31', S, 400, 'sans'], [fmtDay(from), S, 400, 'sans']); for (const d of mondays(from, to)) out.push([fmtDay(d), S, 400, 'sans']); }
    else for (const t of ticksOf(from, to)) out.push([t.label, S, 400, 'sans']);
  }
  return out;
}

export function layoutGantt(band: GanttBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutGantt {
  const S = roles.note;
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
    for (const a of [t.after ?? []].flat()) visit(ids.get(a)!);
    visiting.delete(t); done.add(t);
  };
  tasks.forEach(visit);
  const [from, to] = axisOf(band, [...spans.values()]);
  if (!(from < to)) throw new Error('gantt(): from must be before to');
  for (const [t, [s, e]] of spans) if (s < from || e > to) throw new Error(`gantt(): "${t.label}" (${t.start}${t.end ? ` - ${t.end}` : ''}) is outside the axis (from / to)`);
  const today = band.today !== undefined ? dayOf(band.today, 'today') : undefined;
  if (today !== undefined && (today < from || today >= to)) throw new Error(`gantt(): today (${band.today}) is outside the axis`);

  const labelW = Math.max(...band.rows.map(r => Math.ceil(textWidth(widthOf, isSection(r) ? r.section : r.label, S, isSection(r) ? 700 : 400)))) + 2 * PAD;
  const maxLabel = Math.floor(w * LABEL_MAX);
  if (labelW > maxLabel) throw new Error(`gantt(): the longest row label needs ${labelW}px but only ${maxLabel}px of the ${Math.round(w)}px figure is for labels (shorten it)`);
  const plotL = x + labelW + PAD, plotR = x + w - PAD - 12; // a margin: the diamond of a milestone on the last day sticks out of its day
  if (plotR - plotL < 240) throw new Error('gantt(): the chart area is too narrow (240px at least)');
  const px = (day: number): number => plotL + (day - from) / (to - from) * (plotR - plotL);
  const top = y + HEAD_H, height = HEAD_H + band.rows.length * ROW_H + PAD;
  const out: LaidOutGantt = {
    type: 'gantt', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: height,
    plot: {x1: plotL, x2: plotR, y1: top, y2: y + height - PAD}, ticks: [], sections: [], bars: [], deps: [], texts: [], anchors: [], labelBoxes: [],
  };
  const text = (s: string, tx: number, ty: number, anchor: 'start' | 'middle', bold = false, muted = false, tone?: 'danger'): void => {
    out.texts.push({text: s, x: tx, y: ty, size: S, bold, muted, anchor, ...(tone ? {tone} : {})});
    const tw = textWidth(widthOf, s, S, bold ? 700 : 400);
    out.labelBoxes.push({label: s, x: anchor === 'middle' ? tx - tw / 2 : tx, y: ty - S, w: tw, h: S + 4});
  };

  // ticks: weeks (every n-th Monday) for short axes, else months
  const span = to - from, perDay = (plotR - plotL) / span;
  const tickDays: {day: number; label: string}[] = [];
  if (span <= SHORT_AXIS) {
    const widest = textWidth(widthOf, '12/31', S, 400) + 12;
    const every = Math.max(1, Math.ceil(widest / (7 * perDay)));
    const days = mondays(from, to);
    if (!days.length) tickDays.push({day: from, label: fmtDay(from)}); // a short axis with no Monday: at least its first day
    for (let k = 0; k < days.length; k += every) tickDays.push({day: days[k], label: fmtDay(days[k])});
  } else tickDays.push(...ticksOf(from, to));
  for (const t of tickDays) {
    const tx = px(t.day);
    out.ticks.push({x: tx});
    const tw = textWidth(widthOf, t.label, S, 400);
    if (tx + tw / 2 <= x + w) text(t.label, Math.max(tx, plotL), y + S + 2, 'middle', false, true);
  }

  band.rows.forEach((r, i) => {
    const ry = top + i * ROW_H, cy = ry + ROW_H / 2;
    if (isSection(r)) {
      out.sections.push({x, y: ry, w, h: ROW_H});
      text(r.section, x + PAD, cy + S / 2 - 1, 'start', true);
      return;
    }
    const [s, e] = spans.get(r)!;
    text(r.label, x + PAD, cy + S / 2 - 1, 'start');
    if (r.milestone) {
      const mx = px(s) + perDay / 2, hh = BAR_H / 2 + 2;
      out.bars.push({x: mx - hh, y: cy - hh, w: 2 * hh, h: 2 * hh, tone: r.tone ?? 'accent', milestone: true, label: r.label});
      if (r.id) out.anchors.push({id: r.id, x: mx - hh, y: cy - hh, w: 2 * hh, h: 2 * hh});
      return;
    }
    const bx = px(s), bw = Math.max(4, px(e) - px(s)), rect = {x: bx, y: cy - BAR_H / 2, w: bw, h: BAR_H};
    out.bars.push({...rect, tone: r.tone ?? 'accent', label: r.label, ...(r.progress === undefined ? {} : {progress: r.progress})});
    if (r.id) out.anchors.push({id: r.id, ...rect});
  });
  const rectOf = (t: GanttTask) => out.bars[tasks.indexOf(t)];
  for (const t of tasks) for (const a of [t.after ?? []].flat()) {
    const p = rectOf(ids.get(a)!), q = rectOf(t);
    const x1 = p.x + p.w, y1 = p.y + p.h / 2, x2 = q.x, y2 = q.y + q.h / 2;
    const between = out.bars.filter(b => b !== p && b !== q && b.y + b.h > Math.min(y1, y2) && b.y < Math.max(y1, y2));
    const free = (c: number): boolean => !between.some(b => c >= b.x - 4 && c <= b.x + b.w + 4);
    const tailRow = band.rows.indexOf(ids.get(a)!), headRow = band.rows.indexOf(t), down = headRow > tailRow;
    let pts: Pt[] | undefined;
    // 1) straight on: out of the tail, down (or up) in the first free column before the head, into the head
    for (let c = x1 + 8; c <= x2 - ARROW - 6 && !pts; c += 6) if (free(c)) pts = [{x: x1, y: y1}, {x: c, y: y1}, {x: c, y: y2}, {x: x2, y: y2}];
    // 2) along the line between rows (no bar sits on it): out of the tail to the line below (above) its row, along it to a column free of
    //    the bars of the rows between, to the line beside the head's row, along it to just before the head, into it
    if (!pts) {
      const bT = top + (down ? tailRow + 1 : tailRow) * ROW_H, bH = top + (down ? headRow : headRow + 1) * ROW_H;
      const lo = out.plot.x1 + 4, hi = out.plot.x2 - 4;
      const cols = bT === bH ? [x1 + 8] : Array.from({length: Math.floor((hi - lo) / 6) + 1}, (_, k) => lo + k * 6).filter(free).sort((u, v) => Math.abs(u - (x1 + x2) / 2) - Math.abs(v - (x1 + x2) / 2));
      if (!cols.length) cols.push(x1 + 8); // nothing is free (verify will say which bar): still a route that ends on the head
      pts = [{x: x1, y: y1}, {x: x1 + 8, y: y1}, {x: x1 + 8, y: bT}, {x: cols[0], y: bT}, {x: cols[0], y: bH}, {x: x2 - 8, y: bH}, {x: x2 - 8, y: y2}, {x: x2, y: y2}];
    }
    out.deps.push({from: tasks.indexOf(ids.get(a)!), to: tasks.indexOf(t), points: simplifyPts(pts)});
  }
  if (today !== undefined) {
    const tx = px(today) + perDay / 2;
    out.today = {x: tx, y1: top, y2: out.plot.y2};
    const tl = band.todayLabel ?? '今日', tw = textWidth(widthOf, tl, S, 700);
    text(tl, Math.min(Math.max(tx, x + tw / 2), x + w - tw / 2), y + HEAD_H - 4, 'middle', true, false, 'danger');
  }
  return out;
}
