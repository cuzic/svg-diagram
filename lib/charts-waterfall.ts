// waterfall(): how a start value turns into an end value, step by step. The bars float: an increase stands on the level it starts from
// and rises, a decrease hangs from it, and thin connectors carry the running level from one bar to the next. Every bar prints its value
// with a sign (+120 / -45), so an increase and a decrease differ by the sign and by the direction of the bar, not by colour alone.
import {Canvas, checkDomain, checkIds, checkInset, insetOrNeed, checkText, decimalsIn, fail, finiteNum, numText, signedText, thinTicks, valueScale} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';

import {must} from './must.ts';
export type WaterfallKind = 'start' | 'delta' | 'subtotal' | 'total';
export interface WaterfallStep {
  label: string;
  /** The change (a delta), or the level (start); a subtotal / total may leave it out (the running level is then used) or give it to be checked against the running level. */
  value?: number;
  /** Default: the first step is the 'start', every other a 'delta'. */
  kind?: WaterfallKind;
  /** A spotlight / connect() anchor. */
  id?: string;
  /** Overrides the colour of the bar (default: start / total dark, subtotal muted, increase accent, decrease danger). */
  tone?: ChartTone;
}
export interface WaterfallOpts extends ChartOpts {
  /** Written after every value ('万円', '%'). */
  unit?: string;
  /** Draw the value axis with its ticks (default true). */
  axis?: boolean;
  /** Connectors between the bars (default true). */
  connectors?: boolean;
  /** 'v' (default): the steps left to right, the bars rise and fall. 'h': the steps top to bottom, the bars run right and left (long labels). */
  dir?: 'v' | 'h';
  /** The value axis's end points `[lo, hi]` (widened to round ticks), so that two charts can share one axis: the bars of the same size then have the same length. Smaller than the data is an error. Default: from the data. */
  domain?: readonly [number, number];
  /** false: this chart's axis is its own on purpose (chart-axis-mismatch leaves it alone). */
  axisGroup?: false;
  /** `dir: 'h'` only: how far the plot area starts from the chart's left edge and ends from its right edge, in px (default: what the labels need). Charts written with the same `plotInset` and the same `domain` draw the same value as the same length. Less than the labels need is an error that names the minimum. */
  plotInset?: readonly [left: number, right: number];
}
export interface ResolvedStep {label: string; kind: WaterfallKind; value: number; from: number; to: number; id?: string; tone?: ChartTone}
export interface WaterfallSpec {steps: ResolvedStep[]; unit: string; axis: boolean; connectors: boolean; dir: 'v' | 'h'; domain?: [number, number]; axisGroup?: false; plotInset?: [number, number]}

const KINDS = ['start', 'delta', 'subtotal', 'total'];
/** Works the running level out of the steps (and checks every subtotal / total given against it). */
export function resolveWaterfall(steps: readonly WaterfallStep[], opts: WaterfallOpts): WaterfallSpec {
  if (!Array.isArray(steps) || steps.length < 2) fail('waterfall', 'needs at least two steps (a start and a change)');
  checkIds('waterfall', steps.map(s => s.id), opts.id);
  let level = 0;
  const out: ResolvedStep[] = steps.map((s, i) => {
    const label = checkText('waterfall', `step ${i + 1}'s label`, s.label);
    const kind = s.kind ?? (i === 0 ? 'start' : 'delta');
    if (!KINDS.includes(kind)) fail('waterfall', `step "${label}": kind must be one of ${KINDS.join(', ')} (got ${String(kind)})`);
    if (kind === 'start' && i !== 0) fail('waterfall', `step "${label}": only the first step can be the 'start'`);
    if ((kind === 'subtotal' || kind === 'total') && i === 0) fail('waterfall', `step "${label}": a ${kind} adds up the steps before it, so it cannot be the first step`);
    if (s.tone !== undefined && !['accent', 'danger', 'muted', 'text'].includes(s.tone)) fail('waterfall', `step "${label}": tone must be accent, danger, muted or text`);
    if (kind === 'delta' || kind === 'start') {
      const v = finiteNum('waterfall', `step "${label}"'s value`, s.value);
      if (kind === 'start') { level = v; return {label, kind, value: v, from: 0, to: v, id: s.id, tone: s.tone}; }
      const from = level; level = level + v;
      return {label, kind, value: v, from, to: level, id: s.id, tone: s.tone};
    }
    if (s.value !== undefined) {
      const v = finiteNum('waterfall', `step "${label}"'s value`, s.value);
      if (Math.abs(v - level) > 1e-9 * Math.max(1, Math.abs(level), Math.abs(v))) fail('waterfall', `the ${kind} "${label}" is ${numText(v)}, but the steps before it add up to ${numText(parseFloat(level.toPrecision(12)))}`);
    }
    const v = parseFloat(level.toPrecision(12));
    return {label, kind, value: v, from: 0, to: v, id: s.id, tone: s.tone};
  });
  for (const r of out) { r.from = parseFloat(r.from.toPrecision(12)); r.to = parseFloat(r.to.toPrecision(12)); }
  if (opts.dir !== undefined && opts.dir !== 'v' && opts.dir !== 'h') fail('waterfall', `dir must be 'v' or 'h' (got ${String(opts.dir)})`);
  if (opts.axisGroup !== undefined && opts.axisGroup !== false) fail('waterfall', `axisGroup must be false (this chart's axis is its own) or left out (got ${JSON.stringify(opts.axisGroup)})`);
  const domain = checkDomain('waterfall', opts.domain), plotInset = checkInset('waterfall', opts.plotInset);
  if (plotInset && (opts.dir ?? 'v') !== 'h') fail('waterfall', "plotInset is for dir: 'h' (a vertical waterfall has a plot height to line up, not a left and right inset)");
  const spec: WaterfallSpec = {steps: out, unit: opts.unit ?? '', axis: opts.axis !== false, connectors: opts.connectors !== false, dir: opts.dir ?? 'v', ...(domain ? {domain} : {}), ...(plotInset ? {plotInset} : {}), ...(opts.axisGroup === false ? {axisGroup: false as const} : {})};
  waterfallScale(spec); // a domain smaller than the data fails here, where the chart is written
  return spec;
}

const stepText = (s: ResolvedStep, unit: string): string => `${s.kind === 'delta' ? signedText(s.value) : numText(s.value)}${unit}`;
export const KIND_JA: Record<WaterfallKind, string> = {start: '開始', delta: '増減', subtotal: '小計', total: '合計'};
export function waterfallAlt(spec: WaterfallSpec): string {
  return `ウォーターフォール図: ${spec.steps.map(s => `${s.label} ${stepText(s, spec.unit)}`).join('、')}`;
}

/** The value axis a waterfall is drawn with: from its levels (and 0), or its `domain`. The one place the layout, the description and the axis check all read. */
export const waterfallScale = (spec: WaterfallSpec): ReturnType<typeof valueScale> =>
  valueScale('waterfall', Math.min(0, ...spec.steps.flatMap(s => [s.from, s.to])), Math.max(0, ...spec.steps.flatMap(s => [s.from, s.to])), spec.domain);

export function waterfallTexts(spec: WaterfallSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const s of spec.steps) { out.push([s.label, 400], [s.label, 700], [valueOf(s, spec.unit), 700]); }
  if (spec.axis) for (const t of waterfallScale(spec).ticks) out.push([numText(t), 400]);
  return out;
}

const FILL: Record<WaterfallKind, ChartTone> = {start: 'text', delta: 'accent', subtotal: 'muted', total: 'text'};
const fillOf = (s: ResolvedStep): ChartTone => s.tone ?? (s.kind === 'delta' ? (s.value < 0 ? 'danger' : 'accent') : FILL[s.kind]);

export function layoutWaterfall(spec: WaterfallSpec, g: ChartGeom): LaidOutChartPart {
  if (spec.dir === 'h') return layoutWaterfallH(spec, g);
  const S = g.size, n = spec.steps.length;
  const c = new Canvas(g.x, g.y, g.w, g.height ?? 320, S, g.widthOf, g.wrap);
  const lo = Math.min(0, ...spec.steps.flatMap(s => [s.from, s.to])), sc = waterfallScale(spec);
  const ticks = spec.axis ? sc.ticks.map(t => ({v: t, s: numText(t)})) : [];
  const tickW = Math.max(0, ...ticks.map(t => c.tw(t.s)));
  const plotL = g.x + (spec.axis ? tickW + 18 : 8), plotR = g.x + g.w - 8, slot = (plotR - plotL) / n;
  if (slot < S * 2.2) fail('waterfall', `${n} steps do not fit in ${Math.round(g.w)}px (raise width, or use fewer steps)`);
  const bw = Math.min(72, Math.floor(slot * 0.62));
  // category labels: wrapped to the slot, bold for the bars that are levels (start / subtotal / total)
  const cats = spec.steps.map(s => c.wrap(s.label, slot - 8, s.kind !== 'delta'));
  for (const [i, ls] of cats.entries()) for (const l of ls) if (c.tw(l, must(spec.steps[i]).kind !== 'delta') > slot - 4) fail('waterfall', `the label "${must(spec.steps[i]).label}" is too long for a column ${Math.round(slot)}px wide (shorten it, or raise width)`);
  const catH = Math.max(...cats.map(l => l.length)) * c.lineH() + 6;
  if (g.height === undefined) c.h = 300 + catH;
  const plotT = g.y + 4, plotB = g.y + c.h - catH - 6;
  const yTop = plotT + S + 12, yBot = plotB - S - 12;
  if (yBot - yTop < 80) fail('waterfall', 'the figure is too short for its labels; raise height');
  const yOf = (v: number) => yBot - (v - sc.min) / (sc.max - sc.min) * (yBot - yTop);
  const r1 = (v: number) => Math.round(v * 10) / 10;

  // value axis: the grid at the ticks, the zero line darker
  const shown = thinTicks(ticks, yOf, () => S + 2, 2);
  for (const t of ticks) {
    const y = r1(yOf(t.v));
    c.line(plotL - 6, y, plotR, y, {stroke: t.v === 0 ? 'text' : 'border'});
    if (shown.has(t)) c.text(t.s, plotL - 10, c.mid(y), 'end', 'muted');
  }
  if (!spec.axis && lo < 0) c.line(plotL, r1(yOf(0)), plotR, r1(yOf(0)), {stroke: 'text'});
  else if (!spec.axis) c.line(plotL, r1(yOf(0)), plotR, r1(yOf(0)), {stroke: 'border'});
  if (spec.axis) c.line(plotL, r1(yOf(sc.max)), plotL, r1(yOf(sc.min)), {stroke: 'border'});

  // bars
  const bars = spec.steps.map((s, i) => {
    const cx = plotL + (i + 0.5) * slot, a = yOf(Math.max(s.from, s.to)), b = yOf(Math.min(s.from, s.to));
    const top = Math.abs(b - a) < 2 ? a - 1 : a, h = Math.max(2, b - a);
    const x = r1(cx - bw / 2);
    const solid = c.rect(x, r1(top), bw, r1(h), {fill: fillOf(s), id: s.id, of: s.id ?? `#${i}`, solid: s.id ?? `bar "${s.label}"`});
    return {s, i, cx, x, top, h, solid, fill: fillOf(s), key: s.id ?? `#${i}`};
  });
  // connectors carry the running level: from the end of one bar to the start of the next
  if (spec.connectors) for (const [i, b] of bars.entries()) {
    if (i === n - 1) break;
    const y = r1(yOf(b.s.to));
    c.line(b.x + bw, y, must(bars[i + 1]).x, y, {stroke: 'muted', dash: '4,3', avoid: true, sw: 2});
  }
  // value labels: above a bar that rises (or a level above zero), below one that falls; inside it (in the page colour) when the outside is taken
  for (const b of bars) {
    const text = stepText(b.s, spec.unit), up = b.s.kind === 'delta' ? b.s.value >= 0 : b.s.value >= 0;
    const above = {x: b.cx, y: b.top - 7, anchor: 'middle' as const}, below = {x: b.cx, y: b.top + b.h + S + 5, anchor: 'middle' as const};
    const cands = up ? [above, below] : [below, above];
    const inside = {x: b.cx, y: c.mid(b.top + b.h / 2), anchor: 'middle' as const};
    const fits = b.h >= S + 8 && c.tw(text, true) <= bw - 8;
    const on = {fill: b.fill === 'text' || b.fill === 'accent' || b.fill === 'danger' || b.fill === 'muted' ? b.fill : 'text'} as const;
    const out = c.place(text, cands, b.fill === 'muted' ? 'text' : b.fill, {bold: true, of: b.key}) ?? (fits ? c.text(text, inside.x, inside.y, 'middle', 'bg', {bold: true, of: b.key, on, host: b.solid}) : undefined);
    if (!out) fail('waterfall', `the value "${text}" of "${b.s.label}" has no room (raise width / height, or shorten the unit)`);
  }
  // category labels under the plot
  for (const [i, ls] of cats.entries()) c.lines(ls, plotL + (i + 0.5) * slot, plotB + S + 8, 'middle', 'text', {bold: must(spec.steps[i]).kind !== 'delta', of: must(spec.steps[i]).id ?? `#${i}`});
  void decimalsIn;
  return c.done();
}

/** dir: 'h': the same chart turned on its side: steps down the page, the running level along it. */
function layoutWaterfallH(spec: WaterfallSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, n = spec.steps.length, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf, g.wrap), lh = c.lineH(), r1 = (v: number) => Math.round(v * 10) / 10;
  const lo = Math.min(0, ...spec.steps.flatMap(s => [s.from, s.to])), sc = waterfallScale(spec), ticks = spec.axis ? sc.ticks.map(t => ({v: t, s: numText(t)})) : [];
  const texts = spec.steps.map(s => valueOf(s, spec.unit));
  const valW = Math.max(...texts.map(t => c.tw(t, true))) + 12;
  const labelW = Math.min(Math.max(...spec.steps.map(s => c.tw(s.label, s.kind !== 'delta'))) + 14, g.w * 0.3);
  const cats = spec.steps.map(s => c.wrap(s.label, labelW - 14, s.kind !== 'delta'));
  const [insetL, insetR] = insetOrNeed('waterfall', spec.plotInset, labelW + valW, valW + 8);
  const plotL = g.x + insetL, plotR = g.x + g.w - insetR;
  if (plotR - plotL < 120) fail('waterfall', 'the figure is too narrow for its labels (raise width, shorten the labels / unit)');
  const barH = Math.max(24, S + 10), pitch = Math.max(barH + 14, ...cats.map(l => l.length * lh + 8));
  const axisH = spec.axis ? S + 14 : 6;
  c.h = g.height ?? n * pitch + axisH + 8;
  if (g.height !== undefined && g.height < n * pitch + axisH) fail('waterfall', `height ${g.height} is too small for ${n} steps (need at least ${n * pitch + axisH})`);
  const y0 = g.y + 4, bodyB = y0 + n * pitch;
  const xOf = (v: number) => plotL + (v - sc.min) / (sc.max - sc.min) * (plotR - plotL);
  const shown = thinTicks(ticks, xOf, t => c.tw(t.s), 12);
  for (const t of ticks) { const x = r1(xOf(t.v)); c.line(x, y0, x, bodyB + 6, {stroke: t.v === 0 ? 'text' : 'border'}); if (shown.has(t)) c.text(t.s, x, bodyB + S + 10, 'middle', 'muted'); }
  if (!spec.axis) c.line(r1(xOf(0)), y0, r1(xOf(0)), bodyB, {stroke: lo < 0 ? 'text' : 'border'});
  const bars = spec.steps.map((s, i) => {
    const cy = y0 + (i + 0.5) * pitch, key = s.id ?? `#${i}`, x1 = xOf(Math.min(s.from, s.to)), x2 = xOf(Math.max(s.from, s.to)), w = Math.max(2, x2 - x1);
    const solid = c.rect(r1(Math.abs(x2 - x1) < 2 ? x1 - 1 : x1), r1(cy - barH / 2), r1(w), barH, {fill: fillOf(s), id: s.id, of: key, solid: s.id ?? `bar "${s.label}"`});
    c.lines(must(cats[i]), g.x + labelW - 10 + 0, cy - (must(cats[i]).length - 1) * lh / 2 + S * 0.36, 'end', 'text', {bold: s.kind !== 'delta', of: key});
    return {s, i, cy, x1, x2, solid, key, fill: fillOf(s)};
  });
  if (spec.connectors) for (const [i, b] of bars.entries()) { if (i === n - 1) break; const x = r1(xOf(b.s.to)); c.line(x, b.cy + barH / 2, x, must(bars[i + 1]).cy - barH / 2, {stroke: 'muted', dash: '4,3', avoid: true}); }
  for (const b of bars) {
    const text = must(texts[b.i]), right = b.s.kind === 'delta' ? b.s.value >= 0 : b.s.value >= 0;
    const r = {x: b.x2 + 7, y: c.mid(b.cy), anchor: 'start' as const}, l = {x: b.x1 - 7, y: c.mid(b.cy), anchor: 'end' as const};
    const fits = c.tw(text, true) <= Math.abs(b.x2 - b.x1) - 10;
    const on = {fill: b.fill};
    const out = c.place(text, right ? [r, l] : [l, r], b.fill === 'muted' ? 'text' : b.fill, {bold: true, of: b.key}) ?? (fits ? c.text(text, (b.x1 + b.x2) / 2, c.mid(b.cy), 'middle', 'bg', {bold: true, of: b.key, on, host: b.solid}) : undefined);
    if (!out) fail('waterfall', `the value "${text}" of "${b.s.label}" has no room (raise width, or shorten the unit)`);
  }
  return c.done();
}
