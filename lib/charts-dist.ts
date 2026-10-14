// distplot(): seaborn's distribution plots from the raw values — histplot, kdeplot, ecdfplot, rugplot — one figure, one or several layers
// (a histogram with its density curve and a rug under it), one or several groups (up to four, told apart by colour AND line style). The
// bins, the kernel density and the cumulative step are worked out here (lib/stats.ts, lib/qc.ts); nothing is random.
import {Canvas, checkIds, checkText, fail, finiteNum, niceScale, numText} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';
import {histogramBins} from './qc.ts';
import {binCounts, kde} from './stats.ts';

export type DistKind = 'hist' | 'kde' | 'ecdf' | 'rug';
const KINDS: readonly DistKind[] = ['hist', 'kde', 'ecdf', 'rug'];
export const DIST_FN: Record<DistKind, string> = {hist: 'histplot', kde: 'kdeplot', ecdf: 'ecdfplot', rug: 'rugplot'};
const NAME: Record<DistKind, string> = {hist: 'ヒストグラム', kde: '密度曲線（KDE）', ecdf: '経験累積分布（ECDF）', rug: 'ラグプロット'};
export interface DistGroup {label: string; values: readonly number[]; id?: string}
export type DistStat = 'count' | 'density' | 'probability' | 'percent';
export interface DistOpts extends ChartOpts {
  /** The layers drawn in this order (the function's own by default). `['hist', 'kde']` lays the curve over the bars; `rug` goes with any. */
  kind?: DistKind | readonly DistKind[];
  /** The name of the value axis. */
  label?: string;
  unit?: string;
  /** What the bars (and the curve over them) measure: counts (default for a histogram alone), a density (default with a curve), a share of the group, or its percentage. */
  stat?: DistStat;
  /** Histogram: about this many bins (round class widths), or exactly this class width (`binWidth`). The groups share their bins. */
  bins?: number;
  binWidth?: number;
  /** Histogram: filled bars (default) or only their outline, as one step line (clearer when groups overlap). */
  element?: 'bars' | 'step';
  /** KDE: the bandwidth, as a multiple of Scott's (default 1; smaller follows the data more closely). */
  bw?: number;
  /** Widen the axes to cover at least this range [min, max] — the same range on every panel of a facet() makes their axes the same. */
  xRange?: readonly [number, number];
  yRange?: readonly [number, number];
}
export interface DistSpec {
  groups: {label: string; id?: string; values: number[]}[];
  kinds: DistKind[]; label: string; unit: string; stat: DistStat; element: 'bars' | 'step'; bw: number; bins?: number; binWidth?: number; xRange?: [number, number]; yRange?: [number, number];
  /** The shared classes of the histogram. */
  edges?: number[];
}
const TONES: ChartTone[] = ['accent', 'danger', 'text', 'muted'], DASH = ['', '6,4', '2,4', '10,4,2,4'];
const STATS: DistStat[] = ['count', 'density', 'probability', 'percent'];

export function resolveDist(who: string, data: readonly number[] | readonly DistGroup[] | Readonly<Record<string, readonly number[]>>, opts: DistOpts, defaultKind: DistKind): DistSpec {
  const raw: DistGroup[] = Array.isArray(data) && data.every(d => typeof d === 'number') ? [{label: '', values: data as number[]}]
    : Array.isArray(data) ? [...data as DistGroup[]] : Object.entries(data as Record<string, readonly number[]>).map(([label, values]) => ({label, values}));
  if (raw.length === 0) fail(who, 'needs at least one group of values');
  if (raw.length > TONES.length) fail(who, `at most ${TONES.length} groups (got ${raw.length})`);
  checkIds(who, raw.map(g => g.id), opts.id);
  const kinds = (opts.kind === undefined ? [defaultKind] : Array.isArray(opts.kind) ? [...opts.kind] : [opts.kind]) as DistKind[];
  if (kinds.length === 0 || kinds.some(k => !KINDS.includes(k))) fail(who, `kind must be ${KINDS.join(' / ')} (or a list of them; got ${JSON.stringify(opts.kind)})`);
  if (new Set(kinds).size !== kinds.length) fail(who, 'each kind may appear once in kind');
  if (kinds.includes('ecdf') && (kinds.includes('hist') || kinds.includes('kde'))) fail(who, 'ecdf is a cumulative share on its own axis: it does not go with hist / kde (use rug with it)');
  const groups = raw.map((g, i) => {
    if (raw.length > 1) checkText(who, `group ${i + 1}'s label`, g.label);
    if (!Array.isArray(g.values) || g.values.length === 0) fail(who, `${g.label ? `"${g.label}"` : 'the data'} has no values`);
    const values = g.values.map((v, k) => finiteNum(who, `${g.label ? `"${g.label}" ` : ''}value ${k + 1}`, v));
    if (kinds.includes('kde') && (values.length < 2 || Math.min(...values) === Math.max(...values))) fail(who, `${g.label ? `"${g.label}"` : 'the data'}: a density curve needs at least two different values`);
    return {label: g.label, ...(g.id === undefined ? {} : {id: g.id}), values};
  });
  const stat = opts.stat ?? (kinds.includes('ecdf') ? 'probability' : kinds.includes('kde') ? 'density' : 'count');
  if (!STATS.includes(stat)) fail(who, `stat must be ${STATS.join(' / ')} (got ${String(opts.stat)})`);
  if (kinds.includes('kde') && !kinds.includes('hist') && stat !== 'density') fail(who, `a density curve alone is a density (stat: '${stat}' needs bars to be a count of; add 'hist' to kind)`);
  const element = opts.element ?? 'bars', bw = opts.bw ?? 1;
  if (element !== 'bars' && element !== 'step') fail(who, `element must be bars or step (got ${String(opts.element)})`);
  if (!(bw > 0) || !Number.isFinite(bw)) fail(who, `bw must be a number > 0 (got ${opts.bw})`);
  if (opts.bins !== undefined && opts.binWidth !== undefined) fail(who, 'give bins or binWidth, not both');
  if (opts.bins !== undefined && !(Number.isInteger(opts.bins) && opts.bins >= 1)) fail(who, `bins must be a whole number >= 1 (got ${opts.bins})`);
  if (opts.binWidth !== undefined && !(opts.binWidth > 0 && Number.isFinite(opts.binWidth))) fail(who, `binWidth must be a number > 0 (got ${opts.binWidth})`);
  let edges: number[] | undefined;
  if (kinds.includes('hist')) {
    try { edges = histogramBins(groups.flatMap(g => g.values), {bins: opts.bins, width: opts.binWidth}).edges; } catch (e) { fail(who, (e as Error).message.replace(/^histogram\(\): /, '')); }
  }
  const range = (k: 'xRange' | 'yRange') => { const r = opts[k]; if (r === undefined) return {}; if (!Array.isArray(r) || r.length !== 2 || !r.every(Number.isFinite) || !(r[0] < r[1])) fail(who, `${k} must be [min, max] with min < max (got ${JSON.stringify(r)})`); return {[k]: [r[0], r[1]]}; };
  return {...range('xRange'), ...range('yRange'), groups, kinds, label: opts.label ?? '', unit: opts.unit ?? '', stat, element, bw, ...(opts.bins === undefined ? {} : {bins: opts.bins}), ...(opts.binWidth === undefined ? {} : {binWidth: opts.binWidth}), ...(edges ? {edges} : {})};
}

const ecdfStat = (s: DistSpec): string => s.stat === 'count' ? 'count' : s.stat === 'percent' ? 'percent' : 'proportion';
/** The label of the y axis. */
const yName = (s: DistSpec): string => s.kinds.includes('ecdf') ? (ecdfStat(s) === 'count' ? '累積件数' : ecdfStat(s) === 'percent' ? '累積割合（%）' : '累積割合') : s.stat === 'count' ? '件数' : s.stat === 'density' ? '密度' : s.stat === 'probability' ? '割合' : '割合（%）';
/** What a bar of `c` of `n` values over a class of width `w` reaches, for the statistic. */
const heightOf = (stat: DistStat, c: number, n: number, w: number): number => stat === 'count' ? c : stat === 'density' ? c / (n * w) : stat === 'probability' ? c / n : 100 * c / n;
/** The factor a density becomes the statistic by, over classes of width `w`. */
const factor = (stat: DistStat, n: number, w: number): number => stat === 'count' ? n * w : stat === 'density' ? 1 : stat === 'probability' ? w : 100 * w;
const classW = (s: DistSpec): number => s.edges ? (s.edges[s.edges.length - 1] - s.edges[0]) / (s.edges.length - 1) : 1;

export function distAlt(s: DistSpec): string {
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  return `${s.kinds.map(k => NAME[k]).join('＋')}${s.label ? `（${s.label}）` : ''}: ${s.groups.map(g => `${g.label ? g.label + ' ' : ''}n=${g.values.length} 平均 ${numText(mean(g.values))}${s.unit} 範囲 ${numText(Math.min(...g.values))}〜${numText(Math.max(...g.values))}${s.unit}`).join('、')}`;
}

interface Plan {xs: {min: number; max: number; ticks: number[]}; ys: {min: number; max: number; ticks: number[]}; curves: {x: number; y: number}[][]; bars: {x0: number; x1: number; y: number}[][]}
/** The data coordinates of everything the figure draws: shared by the measurer (ticks) and the layout. */
function plan(s: DistSpec): Plan {
  const all = s.groups.flatMap(g => g.values);
  let lo = Math.min(...all), hi = Math.max(...all);
  const bws = s.kinds.includes('kde') ? s.groups.map(g => kde(g.values, [0], s.bw).bw) : [];
  if (s.edges) { lo = Math.min(lo, s.edges[0]); hi = Math.max(hi, s.edges[s.edges.length - 1]); }
  if (bws.length) { lo = Math.min(lo, ...s.groups.map((g, i) => Math.min(...g.values) - 2 * bws[i])); hi = Math.max(hi, ...s.groups.map((g, i) => Math.max(...g.values) + 2 * bws[i])); }
  if (s.xRange) { lo = Math.min(lo, s.xRange[0]); hi = Math.max(hi, s.xRange[1]); }
  const xs = niceScale(lo, hi);
  const bars = s.edges ? s.groups.map(g => binCounts(g.values, s.edges as number[]).map((c, i) => ({x0: (s.edges as number[])[i], x1: (s.edges as number[])[i + 1], y: heightOf(s.stat, c, g.values.length, classW(s))}))) : [];
  const curves = s.kinds.includes('kde') ? s.groups.map(g => {
    const grid = Array.from({length: 121}, (_q, i) => xs.min + (xs.max - xs.min) * i / 120), f = factor(s.stat, g.values.length, classW(s));
    return kde(g.values, grid, s.bw).density.map((d, i) => ({x: grid[i], y: d * f}));
  }) : [];
  const top = s.kinds.includes('ecdf') ? (s.stat === 'count' ? Math.max(...s.groups.map(g => g.values.length)) : s.stat === 'percent' ? 100 : 1)
    : Math.max(0, ...bars.flat().map(b => b.y), ...curves.flat().map(p => p.y));
  return {xs, ys: niceScale(0, Math.max(top > 0 ? top : 1, s.yRange?.[1] ?? 0)), curves, bars};
}

/** The axes the figure ends up with (what a facet shares between panels). */
export function distAxes(s: DistSpec): {x: [number, number]; y: [number, number]} { const p = plan(s); return {x: [p.xs.min, p.xs.max], y: [p.ys.min, p.ys.max]}; }
export function distTexts(s: DistSpec): [string, number][] {
  const p = plan(s), out: [string, number][] = [];
  for (const g of s.groups) if (g.label) out.push([g.label, 400]);
  if (s.label) out.push([s.label, 700]);
  out.push([yName(s), 700]);
  for (const t of p.xs.ticks) out.push([numText(t), 400]);
  for (const t of p.ys.ticks) out.push([numText(t), 400]);
  return out;
}

export function layoutDist(s: DistSpec, g: ChartGeom): LaidOutChartPart {
  const who = s.kinds.length === 1 ? DIST_FN[s.kinds[0]] : 'displot';
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf), p = plan(s), many = s.groups.length > 1;
  const legend: {x: number; row: number; i: number}[] = [];
  let lx = g.x, row = 0;
  if (many) s.groups.forEach((gr, i) => {
    const w = 28 + 6 + c.tw(gr.label) + 22;
    if (lx + w - 22 > g.x + g.w && lx > g.x) { lx = g.x; row++; }
    legend.push({x: lx, row, i}); lx += w;
  });
  const legendH = many ? (row + 1) * (S + 12) : 0, headH = legendH + S + 10;
  const tickW = Math.max(...p.ys.ticks.map(t => c.tw(numText(t))));
  const plotL = g.x + tickW + 16, plotR = g.x + g.w - Math.ceil(c.tw(numText(p.xs.max)) / 2) - 6;
  if (plotR - plotL < 80) fail(who, 'the figure is too narrow for its labels (raise width)');
  const axisH = S + 14 + (s.label ? S + 10 : 0);
  c.h = g.height ?? 300 + headH;
  const plotT = g.y + headH + Math.ceil(S / 2) + 2, plotB = g.y + c.h - axisH - 6;
  if (plotB - plotT < 100) fail(who, 'the figure is too short; raise height');
  const xOf = (v: number) => plotL + (v - p.xs.min) / (p.xs.max - p.xs.min) * (plotR - plotL), yOf = (v: number) => plotB - (v - p.ys.min) / (p.ys.max - p.ys.min) * (plotB - plotT);
  const r1 = (v: number) => Math.round(v * 10) / 10, pt = (x: number, y: number) => `${r1(xOf(x))},${r1(yOf(y))}`;
  const stroke = (i: number) => ({stroke: TONES[i] as 'accent', dash: DASH[i] || undefined});
  const fillOf = (i: number) => TONES[i] === 'text' ? 'text' : TONES[i];
  // legend, axis names, grid
  legend.forEach(l => {
    const cy = g.y + l.row * (S + 12) + Math.max(9, Math.ceil(S * 0.64));
    if (s.kinds.includes('hist') && s.element === 'bars') c.rect(l.x, cy - 7, 22, 14, {fill: fillOf(l.i), op: 0.25, ...stroke(l.i), sw: 2});
    else c.line(l.x, cy, l.x + 22, cy, {...stroke(l.i), sw: 2});
    c.text(s.groups[l.i].label, l.x + 28, c.mid(cy), 'start', 'text');
  });
  c.text(yName(s), plotL - 4, g.y + legendH + S + 2, 'start', 'muted', {bold: true});
  for (const t of p.ys.ticks) { c.line(plotL - 6, yOf(t), plotR, yOf(t), {stroke: t === 0 ? 'text' : 'border'}); c.text(numText(t), plotL - 10, c.mid(yOf(t)), 'end', 'muted'); }
  for (const t of p.xs.ticks) { c.line(xOf(t), plotB, xOf(t), plotB + 6, {stroke: 'border'}); c.text(numText(t), xOf(t), plotB + S + 10, 'middle', 'muted'); }
  c.line(plotL, plotT, plotL, plotB, {stroke: 'border'});
  if (s.label) c.text(s.label, (plotL + plotR) / 2, plotB + 2 * S + 22, 'middle', 'muted', {bold: true});
  c.anchors.length = 0;
  // layers
  s.groups.forEach((gr, i) => {
    const of = gr.id ?? `#${i}`, bars = p.bars[i], op = many ? 0.18 : 0.3;
    if (s.kinds.includes('hist') && bars) {
      if (s.element === 'bars') bars.forEach(b => { if (b.y > 0) c.path(`M${pt(b.x0, 0)} L${pt(b.x0, b.y)} L${pt(b.x1, b.y)} L${pt(b.x1, 0)} Z`, {fill: fillOf(i), op, ...stroke(i), sw: 2, of}); });
      else {
        const d = bars.map((b, k) => `${k ? 'L' : 'M'}${pt(b.x0, k ? bars[k - 1].y : 0)} L${pt(b.x0, b.y)} L${pt(b.x1, b.y)}`).join(' ') + ` L${pt(bars[bars.length - 1].x1, 0)}`;
        c.path(d, {fill: 'none', ...stroke(i), sw: 2, of});
      }
    }
    if (s.kinds.includes('kde')) {
      const cv = p.curves[i], d = cv.map((q, k) => `${k ? 'L' : 'M'}${pt(q.x, q.y)}`).join(' ');
      if (!s.kinds.includes('hist') || s.element === 'step') c.path(`${d} L${pt(cv[cv.length - 1].x, 0)} L${pt(cv[0].x, 0)} Z`, {fill: fillOf(i), op: many ? 0.12 : 0.2, of});
      c.path(d, {fill: 'none', ...stroke(i), sw: 2, of});
    }
    if (s.kinds.includes('ecdf')) {
      const sorted = [...gr.values].sort((a, b) => a - b), n = sorted.length, k = s.stat === 'count' ? 1 : s.stat === 'percent' ? 100 / n : 1 / n;
      let d = `M${pt(p.xs.min, 0)}`;
      sorted.forEach((v, j) => { d += ` L${pt(v, j * k)} L${pt(v, (j + 1) * k)}`; });
      c.path(`${d} L${pt(p.xs.max, n * k)}`, {fill: 'none', ...stroke(i), sw: 2, of});
    }
    if (s.kinds.includes('rug')) for (const v of gr.values) c.line(xOf(v), plotB - 1 - i * 10, xOf(v), plotB - 9 - i * 10, {...stroke(i), dash: undefined, sw: 1.5, of});
    if (gr.id) c.anchors.push({id: gr.id, x: r1(plotL), y: r1(plotT), w: r1(plotR - plotL), h: r1(plotB - plotT)});
  });
  void Canvas;
  return c.done();
}
