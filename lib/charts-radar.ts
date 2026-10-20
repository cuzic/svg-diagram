// radar(): several measures of one thing on spokes (3-12 axes), the value of each as a distance from the centre, joined into a polygon.
// A concentric grid carries the tick values. Series differ by line style AND marker shape (and the legend names them), never by colour alone.
import {niceNear} from './qc.ts';
import {Canvas, overlaps, checkIds, checkText, fail, finiteNum, niceScale, numText} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';
import type {Rect} from './types/core.ts';

import {must} from './must.ts';
export interface RadarSeries {label: string; values: number[]; id?: string}
export interface RadarOpts extends ChartOpts {
  /** The value at the centre (default 0). */
  min?: number;
  /** The value at the outer ring (default: the largest value rounded up to a round number). */
  max?: number;
  /** How many rings (default 4). */
  rings?: number;
  /** Print the value at every vertex. A value with no room (two series on the same spot) is left out of the drawing. */
  values?: boolean;
  unit?: string;
  /** Shade the inside of the polygon (default: when there is one series). */
  fill?: boolean;
}
export interface RadarSpec {axes: string[]; series: RadarSeries[]; min: number; max: number; rings: number; values: boolean; unit: string; fill: boolean}

export interface SeriesStyle {tone: ChartTone; dash?: string; marker: 'circle' | 'square' | 'diamond' | 'triangle'}
/** The look of the n-th series: a line style and a marker shape of its own, and a colour besides. */
export const SERIES_STYLES: SeriesStyle[] = [
  {tone: 'accent', marker: 'circle'},
  {tone: 'text', dash: '8,5', marker: 'square'},
  {tone: 'danger', dash: '2,5', marker: 'diamond'},
  {tone: 'muted', dash: '10,4,2,4', marker: 'triangle'},
];
/** A marker as a path centred on (x, y), 5px out. */
export function markerPath(shape: SeriesStyle['marker'], x: number, y: number, r = 5): string {
  const f = (v: number) => Math.round(v * 10) / 10;
  switch (shape) {
    case 'circle': return `M${f(x - r)},${f(y)} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0 Z`;
    case 'square': return `M${f(x - r)},${f(y - r)} H${f(x + r)} V${f(y + r)} H${f(x - r)} Z`;
    case 'diamond': return `M${f(x)},${f(y - r - 1)} L${f(x + r + 1)},${f(y)} L${f(x)},${f(y + r + 1)} L${f(x - r - 1)},${f(y)} Z`;
    default: return `M${f(x)},${f(y - r - 1)} L${f(x + r + 1)},${f(y + r)} L${f(x - r - 1)},${f(y + r)} Z`;
  }
}

export function resolveRadar(axes: readonly string[], series: readonly RadarSeries[], opts: RadarOpts): RadarSpec {
  if (!Array.isArray(axes) || axes.length < 3 || axes.length > 12) fail('radar', `needs 3 to 12 axes (got ${Array.isArray(axes) ? axes.length : 0})`);
  if (!Array.isArray(series) || series.length < 1 || series.length > 4) fail('radar', `needs 1 to 4 series (got ${Array.isArray(series) ? series.length : 0}; more cannot be told apart)`);
  axes.forEach((a, i) => checkText('radar', `axis ${i + 1}'s label`, a));
  checkIds('radar', series.map(s => s.id), opts.id);
  const min = finiteNum('radar', 'min', opts.min ?? 0);
  for (const s of series) {
    checkText('radar', 'a series label', s.label);
    if (!Array.isArray(s.values) || s.values.length !== axes.length) fail('radar', `series "${s.label}" has ${Array.isArray(s.values) ? s.values.length : 0} values for ${axes.length} axes`);
    s.values.forEach((v, i) => { if (finiteNum('radar', `"${s.label}" on "${axes[i]}"`, v) < min) fail('radar', `"${s.label}" on "${axes[i]}" is ${v}, below min ${min} (set min lower)`); });
  }
  const dataMax = Math.max(...series.flatMap(s => s.values));
  const max = opts.max !== undefined ? finiteNum('radar', 'max', opts.max) : niceScale(min, Math.max(dataMax, min + 1), 4).max;
  if (!(max > min)) fail('radar', `max (${max}) must be above min (${min})`);
  if (dataMax > max) fail('radar', `a value (${dataMax}) is above max (${max})`);
  // rings on round numbers (a step of 1, 2 or 5 x 10^k) when the range allows 3-6 of them, else 4
  const stepK = niceNear((max - min) / 4), nat = (max - min) / stepK;
  const rings = opts.rings ?? (Math.abs(nat - Math.round(nat)) < 1e-9 && nat >= 3 && nat <= 6 ? Math.round(nat) : 4);
  if (!(Number.isInteger(rings) && rings >= 2 && rings <= 8)) fail('radar', `rings must be a whole number from 2 to 8 (got ${rings})`);
  return {axes: [...axes], series: series.map(s => ({...s, values: [...s.values]})), min, max, rings, values: !!opts.values, unit: opts.unit ?? '', fill: opts.fill ?? series.length === 1};
}
export function radarAlt(s: RadarSpec): string {
  return `レーダーチャート（軸: ${s.axes.join('、')}）。${s.series.map(x => `${x.label}: ${x.values.map((v, i) => `${s.axes[i]} ${numText(v)}${s.unit}`).join('、')}`).join('。')}`;
}
const ringValue = (s: RadarSpec, k: number): number => parseFloat((s.min + (s.max - s.min) * k / s.rings).toPrecision(6));
export function radarTexts(s: RadarSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const a of s.axes) out.push([a, 400], [a, 700]);
  for (const x of s.series) { out.push([x.label, 400]); for (const v of x.values) out.push([`${numText(v)}${s.unit}`, 700]); }
  for (let k = 0; k <= s.rings; k++) out.push([numText(ringValue(s, k)), 400]);
  return out;
}

export function layoutRadar(s: RadarSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, n = s.axes.length, c = new Canvas(g.x, g.y, g.w, g.height ?? 400, S, g.widthOf, g.wrap), lh = c.lineH();
  // legend rows at the bottom: a sample of the line with its marker, then the name
  const items = s.series.map((x, i) => ({x, i, w: 34 + 8 + c.tw(x.label) + 24}));
  const rows: typeof items[] = [[]];
  let rw = 0;
  for (const it of items) { if (rw + it.w - 24 > g.w && must(rows[rows.length - 1]).length) { rows.push([]); rw = 0; } must(rows[rows.length - 1]).push(it); rw += it.w; }
  const legendH = rows.length * (lh + 6) + 8;
  const cx = g.x + g.w / 2, r1 = (v: number) => Math.round(v * 10) / 10;
  const ang = (i: number) => -Math.PI / 2 + 2 * Math.PI * i / n;
  // where the name of axis i stands for a radius R: its anchor, its first baseline and its box
  const nameAt = (i: number, R: number, cy: number, ls: string[]) => {
    const cs = Math.cos(ang(i)), sn = Math.sin(ang(i)), px = cx + cs * R, py = cy + sn * R, h = ls.length * lh;
    const anchor = cs > 0.3 ? 'start' as const : cs < -0.3 ? 'end' as const : 'middle' as const;
    const x = px + cs * 14, top = Math.abs(sn) <= 0.3 ? py - h / 2 : py + sn * 14 - (sn > 0.3 ? 0 : h);
    const w = Math.max(...ls.map(t => c.tw(t, true)));
    return {x, base: top + S, anchor, box: {x: anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x, y: top, w, h: (ls.length - 1) * lh + S + 4}};
  };
  // the names wrap as narrow as they must for neighbours not to touch (axes are 3-12, so the names near the top and bottom crowd first)
  const naturalW = Math.max(...s.axes.map(a => c.tw(a, true)));
  let plan: {labels: string[][]; R: number; cy: number} | undefined;
  for (const maxW of [Math.min(g.w * 0.26, naturalW), Math.min(g.w * 0.18, naturalW), Math.min(g.w * 0.12, naturalW), 44]) {
    const labels = s.axes.map(a => c.wrap(a, maxW + 2, true));
    const labH = Math.max(...labels.map(l => l.length)) * lh, sideW = Math.max(...labels.map(l => Math.max(...l.map(t => c.tw(t, true))))) + 14, vPad = labH + 22;
    const h = g.height ?? Math.max(400, 2 * (vPad + 130) + legendH);
    const areaH = h - legendH, R = Math.min((areaH - 2 * vPad) / 2, (g.w / 2) - sideW - 12), cy = g.y + areaH / 2;
    if (R < 60) continue;
    const boxes = labels.map((ls, i) => nameAt(i, R, cy, ls).box);
    if (boxes.some((b, i) => boxes.slice(i + 1).some(o => overlaps(b, o)))) continue;
    plan = {labels, R, cy}; c.h = h; break;
  }
  if (!plan) fail('radar', 'the figure is too small for its axis names (raise width / height, shorten the names, or use fewer axes)');
  const {labels, R, cy} = must(plan), areaH = c.h - legendH;
  const at = (i: number, f: number) => ({x: cx + Math.cos(ang(i)) * R * f, y: cy + Math.sin(ang(i)) * R * f});
  const poly = (f: number) => `M${Array.from({length: n}, (_, i) => { const p = at(i, f); return `${r1(p.x)},${r1(p.y)}`; }).join(' L')} Z`;
  // grid: rings, then spokes
  for (let k = 1; k <= s.rings; k++) c.path(poly(k / s.rings), {fill: 'none', stroke: 'border', sw: 2});
  for (let i = 0; i < n; i++) { const p = at(i, 1); c.line(cx, cy, p.x, p.y, {stroke: 'border'}); }
  // series: the polygon (shaded for one series), its line in its own style, a marker at each vertex
  const polys = s.series.map(x => x.values.map((v, i) => at(i, (v - s.min) / (s.max - s.min))));
  s.series.forEach((x, k) => {
    const st = must(SERIES_STYLES[k]), pts = must(polys[k]), d = `M${pts.map(p => `${r1(p.x)},${r1(p.y)}`).join(' L')} Z`;
    if (s.fill) c.path(d, {fill: st.tone, op: 0.14, of: x.id ?? `#${k}`});
    c.path(d, {fill: 'none', stroke: st.tone, sw: 3, dash: st.dash, of: x.id ?? `#${k}`});
    pts.forEach((p, i) => { const q = must(pts[(i + 1) % n]); c.segs.push({x1: p.x, y1: p.y, x2: q.x, y2: q.y}); });
    if (x.id) { const xs = pts.map(p => p.x), ys = pts.map(p => p.y); c.anchors.push({id: x.id, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)}); }
  });
  s.series.forEach((x, k) => { const st = must(SERIES_STYLES[k]); for (const p of must(polys[k])) { c.path(markerPath(st.marker, p.x, p.y), {fill: 'bg', stroke: st.tone, sw: 2.5, of: x.id ?? `#${k}`}); c.marks.push({x: p.x - 7, y: p.y - 7, w: 14, h: 14}); } });
  // axis names beyond the outer ring
  for (let i = 0; i < n; i++) { const q = nameAt(i, R, cy, must(labels[i])); c.lines(must(labels[i]), q.x, q.base, q.anchor, 'text', {bold: true}); }
  // tick values: beside one spoke (right of it, or left on the left half), each beside its ring, or just above / below that when the
  // ring's own spot is taken. The spoke that has room for the most of them (the first such) takes them; where the rings are closer than a
  // line of text (a large label size) every 2nd / 3rd ... ring is labelled, counting down from the outer one. A ring with no room anywhere
  // stays unlabelled: no plate is put over the data.
  const minStep = Math.max(1, Math.ceil((S + 6) / (R / s.rings)));
  const tickTexts = Array.from({length: s.rings}, (_, j) => ({k: j + 1, s: numText(ringValue(s, j + 1))})).filter(t => (s.rings - t.k) % minStep === 0);
  let bestTicks: {s: string; x: number; y: number; anchor: 'start' | 'end'}[] = [];
  for (let sp = 0; sp < n; sp++) {
    const right = Math.cos(ang(sp)) >= -1e-9, dx = right ? 9 : -9, anchor = right ? 'start' as const : 'end' as const, got: Rect[] = [], put: typeof bestTicks = [];
    for (const t of [...tickTexts].reverse()) {
      const p = at(sp, t.k / s.rings);
      for (const y of [c.mid(p.y), c.mid(p.y) - Math.round(S * 0.7), c.mid(p.y) + Math.round(S * 0.7)]) {
        const r = c.boxOf(t.s, Math.round(p.x + dx), y, anchor);
        if (!c.free(r) || got.some(o => overlaps(r, o))) continue;
        got.push(r); put.push({s: t.s, x: p.x + dx, y, anchor}); break;
      }
    }
    if (put.length > bestTicks.length) bestTicks = put;
    if (put.length === tickTexts.length) break;
  }
  for (const t of bestTicks) c.text(t.s, t.x, t.y, t.anchor, 'muted');
  // centre value
  // value labels at the vertices (optional): outward first, then to the sides; one with no free place stays out of the drawing and in the description
  if (s.values) s.series.forEach((x, k) => {
    x.values.forEach((v, i) => {
      const p = must(must(polys[k])[i]), text = `${numText(v)}${s.unit}`, cs = Math.cos(ang(i)), sn = Math.sin(ang(i));
      const cands = [14, 22, 32].flatMap(d => [
        {x: p.x + cs * d, y: p.y + sn * d + (sn > 0.3 ? S * 0.9 : sn < -0.3 ? -2 : S * 0.36), anchor: (cs > 0.3 ? 'start' : cs < -0.3 ? 'end' : 'middle') as 'start' | 'middle' | 'end'},
        {x: p.x + 10, y: p.y - 10, anchor: 'start' as const}, {x: p.x - 10, y: p.y - 10, anchor: 'end' as const}, {x: p.x + 10, y: p.y + S + 8, anchor: 'start' as const}, {x: p.x - 10, y: p.y + S + 8, anchor: 'end' as const},
      ]);
      if (!c.place(text, cands, must(SERIES_STYLES[k]).tone === 'muted' ? 'text' : must(SERIES_STYLES[k]).tone, {bold: true, of: x.id ?? `#${k}`})) c.omitted.push(`${x.label} ${s.axes[i]} ${text}`);
    });
  });
  // legend
  let ly = g.y + areaH + 6;
  for (const row of rows) {
    let lx = g.x + (g.w - row.reduce((a, b) => a + b.w, 0) + 24) / 2;
    for (const it of row) {
      const st = must(SERIES_STYLES[it.i]), my = ly + lh / 2 - 1;
      c.line(lx, my, lx + 30, my, {stroke: st.tone, sw: 3, dash: st.dash, of: it.x.id ?? `#${it.i}`});
      c.path(markerPath(st.marker, lx + 15, my), {fill: 'bg', stroke: st.tone, sw: 2.5, of: it.x.id ?? `#${it.i}`});
      c.text(it.x.label, lx + 38, c.mid(my), 'start', 'text', {of: it.x.id ?? `#${it.i}`});
      lx += it.w;
    }
    ly += lh + 6;
  }
  void Canvas;
  return c.done();
}
