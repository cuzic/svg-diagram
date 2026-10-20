// bubble(): a scatter chart whose third measure is the AREA of the circle (portfolio charts: growth × share × revenue). Both axes are
// numeric with round ticks; every bubble is named; a legend circle says what the area stands for. Bubbles may overlap (the larger is
// drawn first), so a name never sits where another bubble is.
import {Canvas, checkIds, checkText, fail, finiteNum, niceScale, numText, thinTicks} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';

export interface BubblePoint {
  label: string;
  x: number;
  y: number;
  /** The measure the area stands for (> 0). */
  size: number;
  tone?: ChartTone;
  id?: string;
}
export interface BubbleAxis {title?: string; unit?: string; min?: number; max?: number; /** A dashed reference line (a threshold: growth 10%, share 1.0). */ line?: number; lineLabel?: string}
export interface BubbleOpts extends ChartOpts {
  x?: BubbleAxis;
  y?: BubbleAxis;
  /** What the area stands for ('売上') and its unit ('億円'): the legend reads "円の面積 = 売上". */
  sizeTitle?: string;
  sizeUnit?: string;
}
export interface BubbleSpec {points: BubblePoint[]; x: BubbleAxis; y: BubbleAxis; sizeTitle: string; sizeUnit: string}

const TONES = ['accent', 'danger', 'muted', 'text'];
export function resolveBubble(points: readonly BubblePoint[], opts: BubbleOpts = {}): BubbleSpec {
  if (!Array.isArray(points) || points.length === 0) fail('bubble', 'needs at least one point');
  if (points.length > 30) fail('bubble', `${points.length} bubbles are too many to name on one figure (at most 30)`);
  checkIds('bubble', points.map(p => p.id), opts.id);
  const list = points.map((p, k) => {
    if (p.tone !== undefined && !TONES.includes(p.tone)) fail('bubble', `"${p.label}" tone must be accent, danger, muted or text`);
    return {label: checkText('bubble', `point ${k + 1}'s label`, p.label), x: finiteNum('bubble', `"${p.label}" x`, p.x), y: finiteNum('bubble', `"${p.label}" y`, p.y), size: finiteNum('bubble', `"${p.label}" size`, p.size), ...(p.tone === undefined ? {} : {tone: p.tone}), ...(p.id === undefined ? {} : {id: p.id})};
  });
  for (const p of list) if (!(p.size > 0)) fail('bubble', `"${p.label}" size must be > 0 (got ${p.size}): the area of a circle cannot stand for zero or a negative`);
  if (new Set(list.map(p => p.label)).size !== list.length) fail('bubble', 'each point needs its own label');
  for (const k of ['x', 'y'] as const) {
    const a = opts[k] ?? {};
    for (const f of ['min', 'max', 'line'] as const) if (a[f] !== undefined) finiteNum('bubble', `${k}.${f}`, a[f]);
    if (a.min !== undefined && a.max !== undefined && !(a.max > a.min)) fail('bubble', `${k}.max must be larger than ${k}.min`);
  }
  return {points: list, x: opts.x ?? {}, y: opts.y ?? {}, sizeTitle: opts.sizeTitle ?? '', sizeUnit: opts.sizeUnit ?? ''};
}
export function bubbleAlt(s: BubbleSpec): string {
  const u = (a: BubbleAxis) => a.unit ?? '';
  return `バブルチャート（横軸: ${s.x.title ?? ''}、縦軸: ${s.y.title ?? ''}、円の面積: ${s.sizeTitle}）: ${s.points.map(p => `${p.label}（${numText(p.x)}${u(s.x)}、${numText(p.y)}${u(s.y)}、${numText(p.size)}${s.sizeUnit}）`).join('、')}`;
}
/** The range an axis covers before it is rounded: the points and the reference line, unless the caller fixed an end. */
function axisRange(s: BubbleSpec, k: 'x' | 'y'): {lo: number; hi: number} {
  const a = s[k], vals = s.points.map(p => p[k]), ref = a.line === undefined ? [] : [a.line];
  return {lo: a.min ?? Math.min(...vals, ...ref), hi: a.max ?? Math.max(...vals, ...ref)};
}
export function bubbleTexts(s: BubbleSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const p of s.points) out.push([p.label, 400], [p.label, 700]);
  for (const k of ['x', 'y'] as const) {
    const a = s[k];
    const r = axisRange(s, k), sc = niceScale(r.lo, r.hi);
    // an axis that is not fixed may be widened by up to MAX_WIDEN ticks on each side (the bubbles at its edge need room)
    for (let i = -MAX_WIDEN; i <= Math.round((sc.max - sc.min) / sc.step) + MAX_WIDEN; i++) { const v = parseFloat((sc.min + i * sc.step).toPrecision(12)); out.push([numText(v), 400], [`${numText(v)}${a.unit ?? ''}`, 400]); }
    if (a.title) out.push([a.title, 700]);
    if (a.lineLabel) out.push([a.lineLabel, 400]);
  }
  out.push([legendText(s, roundBelow(Math.max(...s.points.map(p => p.size)))), 400]);
  return out;
}

const legendText = (s: BubbleSpec, ref: number): string => `${s.sizeTitle ? `円の面積 = ${s.sizeTitle}` : '円の面積'}（円 = ${numText(ref)}${s.sizeUnit}）`;
type Scale = ReturnType<typeof niceScale>;
/** The same scale one tick wider on one side (the step stays, so the ticks stay the multiples the description measured). */
const widen = (sc: Scale, side: 'lo' | 'hi'): Scale => {
  const min = side === 'lo' ? parseFloat((sc.min - sc.step).toPrecision(12)) : sc.min, max = side === 'hi' ? parseFloat((sc.max + sc.step).toPrecision(12)) : sc.max;
  return {min, max, step: sc.step, ticks: side === 'lo' ? [min, ...sc.ticks] : [...sc.ticks, max]};
};
const MAX_WIDEN = 8;
/** A round value for the legend circle: 1, 2 or 5 × a power of ten, at most `v`. */
export function roundBelow(v: number): number {
  const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e;
}

export function layoutBubble(s: BubbleSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, c = new Canvas(g.x, g.y, g.w, g.height ?? 440, S, g.widthOf, g.wrap), r1 = (v: number) => Math.round(v * 10) / 10;
  const xs = axisRange(s, 'x'), ys = axisRange(s, 'y');
  let sx = niceScale(xs.lo, xs.hi), sy = niceScale(ys.lo, ys.hi);

  const tickText = (k: 'x' | 'y', v: number) => `${numText(v)}${s[k].unit ?? ''}`;
  const yTickWOf = () => Math.max(...sy.ticks.map(t => c.tw(tickText('y', t))));
  const maxSize = Math.max(...s.points.map(p => p.size));
  const xTick = Math.ceil(S * 0.36) + 6, titleH = s.y.title ? S + 10 : 0, xAxisH = xTick + S + 6 + (s.x.title ? S + 8 : 0), rMax = Math.max(14, Math.min(40, Math.min(g.w, c.h) / 12)), legendH = Math.max(S + 14, 2 * rMax + 8);
  const xTickHalf = () => Math.ceil(Math.max(...sx.ticks.map(v => c.tw(tickText('x', v)))) / 2) + 2;
  let plotL = g.x + yTickWOf() + 16, plotR = g.x + g.w - Math.max(12, xTickHalf());
  const plotT = g.y + Math.max(titleH + 6, Math.ceil(S * 0.64) + 2), plotB = g.y + c.h - xAxisH - legendH - 4;
  if (plotR - plotL < 160 || plotB - plotT < 120) fail('bubble', 'the figure is too small for its axes (raise width / height)');
  const rMin = 6;
  const radius = (v: number) => Math.max(rMin, rMax * Math.sqrt(v / maxSize));
  let xOf = (v: number) => plotL + (v - sx.min) / (sx.max - sx.min) * (plotR - plotL);
  let yOf = (v: number) => plotB - (v - sy.min) / (sy.max - sy.min) * (plotB - plotT);
  // an axis the caller did not fix grows by a tick until every bubble is inside the plot (a bubble at the data's edge is wider than its point)
  for (let guard = 0; guard < 3 * MAX_WIDEN; guard++) {
    let grew = false;
    for (const p of s.points) {
      const r = radius(p.size);
      if (s.x.min === undefined && xOf(p.x) - r < plotL - 1) { sx = widen(sx, 'lo'); grew = true; }
      if (s.x.max === undefined && xOf(p.x) + r > plotR + 1) { sx = widen(sx, 'hi'); grew = true; }
      if (s.y.min === undefined && yOf(p.y) + r > plotB + 1) { sy = widen(sy, 'lo'); grew = true; }
      if (s.y.max === undefined && yOf(p.y) - r < plotT - 1) { sy = widen(sy, 'hi'); grew = true; }
      if (grew) { plotL = g.x + yTickWOf() + 16; plotR = g.x + g.w - Math.max(12, xTickHalf()); xOf = v => plotL + (v - sx.min) / (sx.max - sx.min) * (plotR - plotL); yOf = v => plotB - (v - sy.min) / (sy.max - sy.min) * (plotB - plotT); break; }
    }
    if (!grew) { const l = g.x + yTickWOf() + 16, r = g.x + g.w - Math.max(12, xTickHalf()); if (l === plotL && r === plotR) break; plotL = l; plotR = r; }
  }
  // grid, ticks, axis titles
  const yt = sy.ticks.map(v => ({v})), xt = sx.ticks.map(v => ({v}));
  const yShown = thinTicks(yt, yOf, () => S + 2, 2), xShown = thinTicks(xt, xOf, t => c.tw(tickText('x', t.v)), 12);
  for (const t of yt) { c.line(plotL, r1(yOf(t.v)), plotR, r1(yOf(t.v)), {stroke: 'border'}); if (yShown.has(t)) c.text(tickText('y', t.v), plotL - 8, c.mid(yOf(t.v)), 'end', 'muted'); }
  for (const t of xt) { c.line(r1(xOf(t.v)), plotT, r1(xOf(t.v)), plotB, {stroke: 'border'}); if (xShown.has(t)) c.text(tickText('x', t.v), r1(xOf(t.v)), plotB + xTick + S, 'middle', 'muted'); }
  c.line(plotL, plotB, plotR, plotB, {stroke: 'text'}); c.line(plotL, plotT, plotL, plotB, {stroke: 'text'});
  if (s.y.title) c.text(s.y.title, plotL, g.y + S, 'start', 'text', {bold: true});
  if (s.x.title) c.text(s.x.title, (plotL + plotR) / 2, plotB + xTick + 2 * S + 8, 'middle', 'text', {bold: true});
  // reference lines (thresholds) with their names
  if (s.x.line !== undefined && s.x.line >= sx.min && s.x.line <= sx.max) {
    const x = r1(xOf(s.x.line)); c.line(x, plotT, x, plotB, {stroke: 'muted', dash: '6,4', sw: 2});
    if (s.x.lineLabel) c.place(s.x.lineLabel, [{x: x + 5, y: plotT + S, anchor: 'start'}, {x: x - 5, y: plotT + S, anchor: 'end'}], 'muted', {plate: true});
  }
  if (s.y.line !== undefined && s.y.line >= sy.min && s.y.line <= sy.max) {
    const y = r1(yOf(s.y.line)); c.line(plotL, y, plotR, y, {stroke: 'muted', dash: '6,4', sw: 2});
    if (s.y.lineLabel) c.place(s.y.lineLabel, [{x: plotR - 4, y: y - 5, anchor: 'end'}, {x: plotR - 4, y: y + S + 4, anchor: 'end'}], 'muted', {plate: true});
  }
  // bubbles: the largest first, so a small one stays visible on a large one; each one's box is a mark the names keep off
  const bs = s.points.map((p, i) => ({p, i, cx: xOf(p.x), cy: yOf(p.y), r: radius(p.size), tone: p.tone ?? 'accent' as ChartTone, key: p.id ?? `#${i}`}));
  for (const b of [...bs].sort((a, z) => z.r - a.r || a.i - z.i)) {
    if (b.cx - b.r < plotL - 2 || b.cx + b.r > plotR + 2 || b.cy - b.r < plotT - 2 || b.cy + b.r > plotB + 2) fail('bubble', `the bubble "${b.p.label}" runs out of the plot (widen the axis: x / y min / max)`);
    const rr = r1(b.r), d = `M${r1(b.cx - rr)},${r1(b.cy)} a${rr},${rr} 0 1,0 ${r1(2 * rr)},0 a${rr},${rr} 0 1,0 ${r1(-2 * rr)},0 Z`;
    c.path(d, {fill: b.tone, op: 0.3, stroke: b.tone, sw: 2, of: b.key});
    c.anchors.push({id: b.p.id ?? `#${b.i}`, x: r1(b.cx - rr), y: r1(b.cy - rr), w: r1(2 * rr), h: r1(2 * rr)});
  }
  c.anchors.splice(0, c.anchors.length, ...c.anchors.filter(a => !a.id.startsWith('#')));
  for (const b of bs) c.marks.push({x: b.cx - b.r, y: b.cy - b.r, w: 2 * b.r, h: 2 * b.r});
  // names: inside a bubble that holds its own name (the bubble's rect is the only mark then), else beside it, above, below
  for (const b of [...bs].sort((a, z) => z.r - a.r || a.i - z.i)) {
    const label = b.p.label, w = c.tw(label, true), mine = c.marks[b.i], at = (x: number, y: number, anchor: 'start' | 'middle' | 'end') => ({x, y, anchor});
    const inside = c.boxOf(label, Math.round(b.cx), c.mid(b.cy), 'middle', true);
    const roomInside = w + 8 <= 2 * b.r * 0.82 && S + 6 <= 2 * b.r * 0.82;
    if (roomInside) {
      const others = c.marks.filter(m => m !== mine);
      if (!c.boxes.some(o => overlaps2(inside, o)) && !others.some(m => overlaps2(inside, m))) { c.text(label, b.cx, c.mid(b.cy), 'middle', 'text', {bold: true, of: b.key, on: {fill: b.tone, op: 0.3, ink: 'text'}}); continue; }
    }
    c.marks.splice(b.i, 1, {x: 0, y: 0, w: 0, h: 0}); // free its own box while its name is placed (the name may touch its bubble)
    const gap = 6, cands = [
      at(b.cx + b.r + gap, c.mid(b.cy), 'start'), at(b.cx - b.r - gap, c.mid(b.cy), 'end'),
      at(b.cx, b.cy - b.r - gap, 'middle'), at(b.cx, b.cy + b.r + gap + S, 'middle'),
      at(b.cx + b.r * 0.7 + gap, b.cy - b.r * 0.7 - gap, 'start'), at(b.cx - b.r * 0.7 - gap, b.cy - b.r * 0.7 - gap, 'end'),
      at(b.cx + b.r * 0.7 + gap, b.cy + b.r * 0.7 + gap + S, 'start'), at(b.cx - b.r * 0.7 - gap, b.cy + b.r * 0.7 + gap + S, 'end'),
    ];
    const done = c.place(label, cands, 'text', {bold: true, of: b.key});
    c.marks[b.i] = {x: b.cx - b.r, y: b.cy - b.r, w: 2 * b.r, h: 2 * b.r};
    if (!done) fail('bubble', `the name "${label}" has no room beside its bubble (thin out the points, or raise width / height)`);
  }
  // the size legend: a circle of a round value, drawn at the same scale as the bubbles
  const ref = roundBelow(maxSize), rr = radius(ref), ltext = legendText(s, ref);
  if (rr * 2 + 12 + c.tw(ltext) > g.w) fail('bubble', 'the size legend does not fit (shorten sizeTitle / sizeUnit, or raise width)');
  const lcy = g.y + c.h - legendH / 2;
  c.path(`M${r1(plotL + 2)},${r1(lcy)} a${r1(rr)},${r1(rr)} 0 1,0 ${r1(2 * rr)},0 a${r1(rr)},${r1(rr)} 0 1,0 ${r1(-2 * rr)},0 Z`, {fill: 'text', op: 0.15, stroke: 'text', sw: 2});
  c.text(ltext, plotL + 2 * rr + 12, c.mid(lcy), 'start', 'text');
  return c.done();
}
const overlaps2 = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
