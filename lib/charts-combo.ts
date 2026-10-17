// combo(): bars and lines on one figure (revenue as bars, margin as a line). Bars always read on the left axis; a line reads on the right
// axis by default (its own unit, drawn at its own scale) or on the left. Every value is written; one that finds no room stays in the
// description. The bars are light so a line and its numbers can run over them.
import {Canvas, checkIds, checkText, fail, finiteNum, niceScale, numText, thinTicks} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';
import type {ColorKey} from './types/core.ts';

export interface ComboSeries {
  label: string;
  type: 'bar' | 'line';
  /** One value per category (null: no value — a gap in a line, no bar). */
  values: readonly (number | null)[];
  /** The axis a line reads on (default 'right'). A bar is always on the left. */
  axis?: 'left' | 'right';
  tone?: ChartTone;
  id?: string;
}
export interface ComboAxis {min?: number; max?: number; /** The unit written after every value on this axis ('億円', '%'). */ unit?: string; /** A title over the axis (default: the unit). */ title?: string}
export interface ComboOpts extends ChartOpts {
  y?: ComboAxis;
  y2?: ComboAxis;
  /** Write the values (default true). */
  values?: boolean;
  /** Stack the bar series in one column per category (values must be >= 0); the column's total is written above it. */
  stack?: boolean;
}
export interface ComboSpec {categories: string[]; series: (Required<Pick<ComboSeries, 'label' | 'type' | 'axis'>> & {values: (number | null)[]; tone: ChartTone; id?: string})[]; y: ComboAxis; y2: ComboAxis; values: boolean; stack: boolean}

const BAR_TONES: ChartTone[] = ['accent', 'text', 'muted'], LINE_TONES: ChartTone[] = ['danger', 'text', 'accent'];
export function resolveCombo(categories: readonly string[], series: readonly ComboSeries[], opts: ComboOpts = {}): ComboSpec {
  if (!Array.isArray(categories) || categories.length < 2) fail('combo', 'needs at least two categories');
  if (categories.length > 24) fail('combo', `${categories.length} categories are too many for one figure (at most 24)`);
  categories.forEach((k, i) => checkText('combo', `category ${i + 1}`, k));
  if (!Array.isArray(series) || series.length === 0) fail('combo', 'needs at least one series');
  if (new Set(categories).size !== categories.length) fail('combo', 'each category needs its own name');
  const bars = series.filter(s => s.type === 'bar'), lines = series.filter(s => s.type === 'line');
  if (bars.length + lines.length !== series.length) fail('combo', `each series' type must be 'bar' or 'line'`);
  if (bars.length > 3) fail('combo', `${bars.length} bar series are too many to tell apart (at most 3)`);
  if (lines.length > 3) fail('combo', `${lines.length} line series are too many to tell apart (at most 3)`);
  checkIds('combo', series.map(s => s.id), opts.id);
  const labels = series.map((s, i) => checkText('combo', `series ${i + 1}'s label`, s.label));
  if (new Set(labels).size !== labels.length) fail('combo', 'each series needs its own label');
  const tones = ['accent', 'danger', 'muted', 'text'];
  let b = 0, l = 0;
  const out = series.map(s => {
    if (!Array.isArray(s.values) || s.values.length !== categories.length) fail('combo', `"${s.label}" needs ${categories.length} values, one per category (got ${Array.isArray(s.values) ? s.values.length : 'none'}; null is a gap)`);
    if (s.tone !== undefined && !tones.includes(s.tone)) fail('combo', `"${s.label}" tone must be accent, danger, muted or text`);
    if (s.axis !== undefined && s.axis !== 'left' && s.axis !== 'right') fail('combo', `"${s.label}" axis must be left or right`);
    if (s.type === 'bar' && s.axis === 'right') fail('combo', `"${s.label}": a bar is always on the left axis (put the line on the right)`);
    const values = s.values.map((v, i) => v === null ? null : finiteNum('combo', `"${s.label}" value ${i + 1}`, v));
    if (values.every(v => v === null)) fail('combo', `"${s.label}" has no value`);
    const tone = s.tone ?? (s.type === 'bar' ? BAR_TONES[b++] : LINE_TONES[l++]);
    return {label: s.label, type: s.type, axis: s.type === 'bar' ? 'left' as const : s.axis ?? (bars.length ? 'right' as const : 'left' as const), values, tone, ...(s.id === undefined ? {} : {id: s.id})};
  });
  for (const a of ['y', 'y2'] as const) {
    const ax = opts[a] ?? {};
    for (const f of ['min', 'max'] as const) if (ax[f] !== undefined) finiteNum('combo', `${a}.${f}`, ax[f]);
    if (ax.min !== undefined && ax.max !== undefined && !(ax.max > ax.min)) fail('combo', `${a}.max must be larger than ${a}.min`);
  }
  if (!out.some(s => s.axis === 'left')) fail('combo', 'needs a bar or a line on the left axis (the left axis is the one the figure is read from)');
  // a fixed axis must hold its data: bars stand on 0, so a left axis that starts above 0 would cut them
  for (const a of ['left', 'right'] as const) {
    const ax = (a === 'left' ? opts.y : opts.y2) ?? {}, mine = out.filter(s => s.axis === a), v = mine.flatMap(s => s.values.flatMap(x => x === null ? [] : [x]));
    const top = opts.stack && a === 'left' ? categories.map((_k, i) => mine.reduce((acc, s) => acc + (s.type === 'bar' ? s.values[i] ?? 0 : 0), 0)) : [];
    const hasBar = a === 'left' && mine.some(s => s.type === 'bar'), name = a === 'left' ? 'y' : 'y2';
    if (ax.max !== undefined && Math.max(...v, ...top, ...(hasBar ? [0] : [])) > ax.max) fail('combo', `${name}.max ${ax.max} is below the data (${Math.max(...v, ...top, ...(hasBar ? [0] : []))}): raise it, or leave it out`);
    if (ax.min !== undefined && Math.min(...v, ...(hasBar ? [0] : [])) < ax.min) fail('combo', `${name}.min ${ax.min} is above ${hasBar && ax.min > 0 ? 'zero, where bars start' : `the data (${Math.min(...v)})`}: lower it, or leave it out`);
  }
  if (opts.stack && bars.length < 2) fail('combo', 'stack needs at least two bar series');
  if (opts.stack) for (const s of out) if (s.type === 'bar' && s.values.some(v => v !== null && v < 0)) fail('combo', `"${s.label}": stacked bars cannot be negative`);
  if (!out.some(s => s.axis === 'right') && opts.y2 !== undefined) fail('combo', 'y2 is given but no series reads on the right axis');
  return {categories: [...categories], series: out, y: opts.y ?? {}, y2: opts.y2 ?? {}, values: opts.values !== false, stack: opts.stack === true};
}
const unitOf = (s: ComboSpec, axis: 'left' | 'right'): string => (axis === 'left' ? s.y : s.y2).unit ?? '';
const vals = (s: ComboSpec, axis: 'left' | 'right'): number[] => s.series.filter(x => x.axis === axis).flatMap(x => x.values.flatMap(v => v === null ? [] : [v]));
export function comboAlt(s: ComboSpec): string {
  return `コンボチャート: ${s.series.map(x => `${x.type === 'bar' ? '棒' : '折れ線'} ${x.label}（${s.categories.map((k, i) => `${k} ${x.values[i] === null ? 'なし' : numText(x.values[i] as number) + unitOf(s, x.axis)}`).join('、')}）`).join('、')}`;
}
/** The sum of the bar series in each category (stacked columns). */
const totals = (s: ComboSpec): number[] => s.categories.map((_k, i) => s.series.reduce((a, x) => a + (x.type === 'bar' ? x.values[i] ?? 0 : 0), 0));
/** The scale of an axis: bars (left) reach down to zero; the ticks are round. */
function scaleOf(s: ComboSpec, axis: 'left' | 'right', want = 5) {
  const ax = axis === 'left' ? s.y : s.y2, v = vals(s, axis), hasBar = axis === 'left' && s.series.some(x => x.type === 'bar');
  const top = s.stack && hasBar ? totals(s) : [];
  const lo = ax.min ?? Math.min(...v, ...(hasBar ? [0] : [])), hi = ax.max ?? Math.max(...v, ...top, ...(hasBar ? [0] : []));
  return niceScale(lo, hi, want);
}
export function comboTexts(s: ComboSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const k of s.categories) out.push([k, 400]);
  for (const x of s.series) {
    out.push([x.label, 400]);
    for (const v of x.values) if (v !== null) out.push([`${numText(v)}${unitOf(s, x.axis)}`, 700]);
  }
  if (s.stack) for (const v of totals(s)) out.push([`${numText(v)}${unitOf(s, 'left')}`, 700]);
  for (const axis of ['left', 'right'] as const) {
    if (!s.series.some(x => x.axis === axis)) continue;
    const ax = axis === 'left' ? s.y : s.y2;
    for (let w = 1; w <= 16; w++) for (const t of scaleOf(s, axis, w).ticks) out.push([numText(t), 400]);
    if (ax.title ?? ax.unit) out.push([ax.title ?? ax.unit ?? '', 700]);
  }
  return out;
}

export function layoutCombo(s: ComboSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, n = s.categories.length, c = new Canvas(g.x, g.y, g.w, g.height ?? 380, S, g.widthOf, g.wrap), r1 = (v: number) => Math.round(v * 10) / 10;
  const hasRight = s.series.some(x => x.axis === 'right');
  const sl = scaleOf(s, 'left'), intervals = sl.ticks.length - 1;
  // the right axis gets as many intervals as the left one, so its ticks sit on the grid; failing that, its own ticks are written without grid
  let sr = hasRight ? scaleOf(s, 'right') : undefined, aligned = false;
  if (hasRight) for (const w of [intervals, intervals - 1, intervals + 1, intervals - 2, intervals + 2, 2, 3, 4, 5, 6, 7, 8]) { const t = scaleOf(s, 'right', Math.max(1, w)); if (t.ticks.length - 1 === intervals) { sr = t; aligned = true; break; } }
  const lw = Math.max(...sl.ticks.map(t => c.tw(numText(t)))), rw = sr ? Math.max(...sr.ticks.map(t => c.tw(numText(t)))) : 0;
  const plotL = g.x + lw + 14, plotR = g.x + g.w - (hasRight ? rw + 14 : 8), slot = (plotR - plotL) / n;
  if (slot < S * 2.2) fail('combo', `${n} categories do not fit in ${Math.round(g.w)}px (raise width, or use fewer categories)`);
  const bars = s.series.filter(x => x.type === 'bar'), lines = s.series.filter(x => x.type === 'line');
  const nb = s.stack ? 1 : bars.length, groupW = Math.min(slot * 0.7, (s.stack ? 72 : 56 * bars.length)), bw = nb ? Math.floor(groupW / nb) - (nb > 1 ? 2 : 0) : 0;
  const cats = s.categories.map(k => c.wrap(k, slot - 6)), catH = Math.max(...cats.map(l => l.length)) * c.lineH() + Math.ceil(S * 0.36) + 6;
  for (const [i, ls] of cats.entries()) for (const l of ls) if (c.tw(l) > slot - 2) fail('combo', `the category "${s.categories[i]}" is too long for a column ${Math.round(slot)}px wide (shorten it, or raise width)`);
  // legend over the plot (rows of swatch + name), then the axis titles
  const sw = 14, item = (x: ComboSeries | ComboSpec['series'][number]) => (x.type === 'bar' ? sw : sw + 10) + 6 + c.tw(x.label);
  const legend: {x: number; row: number; s: ComboSpec['series'][number]}[] = [];
  { let lx = plotL, row = 0;
    for (const x of s.series) { if (item(x) > g.w) fail('combo', `the series name "${x.label}" is wider than the figure (shorten it, or raise width)`); if (lx > plotL && lx + item(x) > g.x + g.w) { lx = plotL; row++; } legend.push({x: lx, row, s: x}); lx += item(x) + 22; } }
  const legendRows = legend[legend.length - 1].row + 1, rowPitch = S + 12;
  const axTitle = (ax: ComboAxis) => ax.title ?? ax.unit ?? '';
  const titleH = (axTitle(s.y) || (hasRight && axTitle(s.y2))) ? S + 10 : 0;
  const headH = legendRows * rowPitch + titleH + 4;
  const plotT = g.y + headH, plotB = g.y + c.h - catH - 6;
  const yTop = plotT + Math.ceil(S / 2) + 4, yBot = plotB;
  if (yBot - yTop < 100) fail('combo', 'the figure is too short for its labels; raise height');
  const yL = (v: number) => yBot - (v - sl.min) / (sl.max - sl.min) * (yBot - yTop);
  const yR = (v: number) => yBot - (v - (sr as NonNullable<typeof sr>).min) / ((sr as NonNullable<typeof sr>).max - (sr as NonNullable<typeof sr>).min) * (yBot - yTop);
  const yOf = (x: ComboSpec['series'][number]) => (x.axis === 'left' ? yL : yR);
  const text = (x: ComboSpec['series'][number], v: number) => `${numText(v)}${unitOf(s, x.axis)}`;
  const shape = (i: number) => (['disc', 'square', 'diamond'] as const)[i];
  const mark = (kind: 'disc' | 'square' | 'diamond', cx: number, cy: number, r: number, tone: ColorKey, of: string) => {
    const d = kind === 'disc' ? `M${r1(cx - r)},${r1(cy)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z` : kind === 'square' ? `M${r1(cx - r)},${r1(cy - r)} h${2 * r} v${2 * r} h${-2 * r} Z` : `M${r1(cx)},${r1(cy - r - 1)} l${r + 1},${r + 1} l${-r - 1},${r + 1} l${-r - 1},${-r - 1} Z`;
    c.path(d, {fill: tone, stroke: 'bg', sw: 1, of});
    c.marks.push({x: cx - r - 1, y: cy - r - 1, w: 2 * r + 2, h: 2 * r + 2});
  };
  // legend
  for (const L of legend) {
    const cy = g.y + L.row * rowPitch + Math.max(4 + sw / 2, Math.ceil(S * 0.64)), key = L.s.id ?? L.s.label;
    if (L.s.type === 'bar') c.rect(L.x, cy - sw / 2, sw, sw, {fill: L.s.tone, op: 0.4, stroke: L.s.tone, sw: 1});
    else { c.line(L.x, cy, L.x + sw + 10, cy, {stroke: L.s.tone, sw: 3, dash: lines.indexOf(L.s as never) === 1 ? '6,4' : undefined}); mark(shape(lines.indexOf(L.s as never)), L.x + (sw + 10) / 2, cy, 4, L.s.tone, key); }
    c.text(L.s.label, L.x + (L.s.type === 'bar' ? sw : sw + 10) + 6, c.mid(cy), 'start', 'text');
  }
  c.marks.length = 0;
  // axes: the grid from the left ticks; the right ticks are written beside it
  const tk = sl.ticks.map(v => ({v})), shown = thinTicks(tk, yL, () => S + 2, 2);
  for (const t of tk) { const y = r1(yL(t.v)); c.line(plotL - 6, y, plotR + (hasRight ? 6 : 0), y, {stroke: t.v === 0 ? 'text' : 'border'}); if (shown.has(t)) c.text(numText(t.v), plotL - 10, c.mid(y), 'end', 'muted'); }
  if (sr) {
    const rt = sr.ticks.map(v => ({v})), rShown = thinTicks(rt, yR, () => S + 2, 2);
    for (const t of rt) { const y = r1(yR(t.v)); if (!aligned) c.line(plotR, y, plotR + 6, y, {stroke: 'border'}); if (rShown.has(t)) c.text(numText(t.v), plotR + 10, c.mid(y), 'start', 'muted'); }
  }
  if (axTitle(s.y)) c.text(axTitle(s.y), g.x, plotT - 6, 'start', 'text', {bold: true});
  if (hasRight && axTitle(s.y2)) c.text(axTitle(s.y2), g.x + g.w, plotT - 6, 'end', 'text', {bold: true});
  // bars: side by side in each category; light, so a line may cross them
  const stackedBelow = s.categories.map(() => 0);
  const barGeo = bars.map((x, bi) => x.values.map((v, i) => {
    if (v === null) return undefined;
    const cx = plotL + (i + 0.5) * slot, x0 = s.stack ? cx - bw / 2 : cx - groupW / 2 + bi * (bw + (nb > 1 ? 2 : 0)) + (groupW - nb * bw - (nb - 1) * (nb > 1 ? 2 : 0)) / 2;
    const base = s.stack ? stackedBelow[i] : 0;
    if (s.stack) stackedBelow[i] += v;
    const a = yL(Math.max(v, 0) + base), b = yL(Math.min(v, 0) + base), top = b - a < 2 ? a - 1 : a, h = Math.max(2, b - a), key = x.id ?? x.label;
    c.rect(r1(x0), r1(top), bw, r1(h), {fill: x.tone, op: 0.4, stroke: x.tone, sw: 1, of: key});
    return {x, v, cx: x0 + bw / 2, top, h, key};
  }));
  // lines: the path, then the markers
  const lineGeo = lines.map((x, li) => {
    const pts = x.values.map((v, i) => v === null ? undefined : {x: plotL + (i + 0.5) * slot, y: yOf(x)(v), v, i});
    const key = x.id ?? x.label;
    let d = '', pen = false;
    for (const p of pts) { if (!p) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${r1(p.x)},${r1(p.y)} `; pen = true; }
    c.path(d.trim(), {fill: 'none', stroke: x.tone, sw: 3, dash: li === 1 ? '6,4' : undefined, of: key});
    for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1]; if (a && b) c.segs.push({x1: a.x, y1: a.y, x2: b.x, y2: b.y}); }
    for (const p of pts) if (p) mark(shape(li), p.x, p.y, 4, x.tone, key);
    return {x, pts, key};
  });
  // anchors of the series that have an id: the bars of a series / the line's box
  for (const [bi, x] of bars.entries()) if (x.id) { const g2 = barGeo[bi].filter((q): q is NonNullable<typeof q> => !!q); const x1 = Math.min(...g2.map(q => q.cx - bw / 2)), x2 = Math.max(...g2.map(q => q.cx + bw / 2)), y1 = Math.min(...g2.map(q => q.top)), y2 = Math.max(...g2.map(q => q.top + q.h)); c.anchors.push({id: x.id, x: r1(x1), y: r1(y1), w: r1(x2 - x1), h: r1(y2 - y1)}); }
  for (const L of lineGeo) if (L.x.id) { const p = L.pts.filter((q): q is NonNullable<typeof q> => !!q); const x1 = Math.min(...p.map(q => q.x)) - 5, x2 = Math.max(...p.map(q => q.x)) + 5, y1 = Math.min(...p.map(q => q.y)) - 5, y2 = Math.max(...p.map(q => q.y)) + 5; c.anchors.push({id: L.x.id, x: r1(x1), y: r1(y1), w: r1(x2 - x1), h: r1(y2 - y1)}); }
  // a value stays between the top of the plot and its floor (below it are the category names)
  const inPlot = (b: {y: number; h: number}) => b.y >= plotT - 2 && b.y + b.h <= plotB + 1;
  // values: a bar's above it (below a negative one); a line's above, below, then beside the point; the one with no room stays in the description
  if (s.values) {
    for (const row of barGeo) for (const q of row) {
      if (!q) continue;
      const t = text(q.x, q.v), up = q.v >= 0;
      if (s.stack) { // inside its own segment, or left to the description
        const fits = q.h >= S + 6 && c.tw(t, true) <= bw - 4;
        if (!fits || !c.place(t, [{x: q.cx, y: c.mid(q.top + q.h / 2), anchor: 'middle'}], 'text', {bold: true, of: q.key})) c.omitted.push(`${q.x.label} ${s.categories[Math.round((q.cx - plotL) / slot - 0.5)]} ${t}`);
        continue;
      }
      const cands = [{x: q.cx, y: q.top - 6, anchor: 'middle' as const}, {x: q.cx, y: q.top + q.h + S + 4, anchor: 'middle' as const}];
      const inside = {x: q.cx, y: c.mid(q.top + q.h / 2), anchor: 'middle' as const};
      const ok = (cs: typeof cands) => cs.filter(k => inPlot(c.boxOf(t, k.x, k.y, k.anchor, true)));
      if (!c.place(t, ok(up ? [...cands, inside] : [cands[1], cands[0], inside]), 'text', {bold: true, of: q.key})) c.omitted.push(`${q.x.label} ${s.categories[Math.round((q.cx - plotL) / slot - 0.5)]} ${t}`);
    }
    if (s.stack) totals(s).forEach((v, i) => {
      const t = `${numText(v)}${unitOf(s, 'left')}`, top = yL(v), cx = plotL + (i + 0.5) * slot;
      const cs = [{x: cx, y: top - 6, anchor: 'middle' as const}].filter(k => inPlot(c.boxOf(t, k.x, k.y, k.anchor, true)));
      if (!c.place(t, cs, 'text', {bold: true})) c.omitted.push(`合計 ${s.categories[i]} ${t}`);
    });
    for (const L of lineGeo) for (const p of L.pts) {
      if (!p) continue;
      const t = text(L.x, p.v), r = 7;
      const cands = [
        {x: p.x, y: p.y - r - 3, anchor: 'middle' as const}, {x: p.x, y: p.y + r + S + 1, anchor: 'middle' as const},
        {x: p.x + r + 4, y: c.mid(p.y), anchor: 'start' as const}, {x: p.x - r - 4, y: c.mid(p.y), anchor: 'end' as const},
        {x: p.x + r, y: p.y - r - 3, anchor: 'start' as const}, {x: p.x - r, y: p.y - r - 3, anchor: 'end' as const},
      ];
      if (!c.place(t, cands.filter(k => inPlot(c.boxOf(t, k.x, k.y, k.anchor, true))), L.x.tone === 'muted' ? 'text' : L.x.tone, {bold: true, of: L.key})) c.omitted.push(`${L.x.label} ${s.categories[p.i]} ${t}`);
    }
  }
  for (const [i, ls] of cats.entries()) c.lines(ls, plotL + (i + 0.5) * slot, plotB + Math.ceil(S * 0.36) + S + 8, 'middle', 'text');
  return c.done();
}
