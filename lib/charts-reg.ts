// regplot() / residplot(): seaborn's regression plots from raw columns. regplot is a scatter with the least-squares line (or a polynomial of
// order 2 / 3) and the 95% confidence band of the fitted mean; one fit per group (up to 4: marker shape, line style and colour all differ).
// residplot is the scatter of the residuals around the same fit, with the zero line. Nothing is random.
import {Canvas, checkIds, checkText, fail, finiteNum, niceScale, numText} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';
import {markerPath, SHAPES} from './charts-cat.ts';
import {lowessFit, meanOf, polyFit} from './stats.ts';
import type {PolyFit} from './stats.ts';

export interface RegOpts extends ChartOpts {
  xLabel?: string;
  yLabel?: string;
  /** The polynomial order of the fit: 1 (a line, default), 2 or 3. */
  order?: 1 | 2 | 3;
  /** Draw the 95% confidence band of the fit (default true). */
  band?: boolean;
  /** Write the equation (a line) and R² of each fit in the legend. */
  stats?: boolean;
  /** Draw a LOWESS curve (locally weighted line, robust to outliers) instead of the polynomial: no band, no equation. For `residplot`: a LOWESS curve of the residuals over the points, to show what the fit missed. */
  lowess?: boolean;
  /** LOWESS: the share of the points each local fit uses (0 to 1, default 2/3; smaller follows the data more closely). */
  frac?: number;
  /** One label per row: each label is a group with a fit of its own (up to 4). */
  groups?: readonly string[];
  /** Widen the axes to cover at least this range [min, max] — the same range on every panel of a facet() makes their axes the same. */
  xRange?: readonly [number, number];
  yRange?: readonly [number, number];
}
export interface RegData {x: readonly number[]; y: readonly number[]; group?: readonly string[]}
export interface RegSpec {
  xRange?: [number, number]; yRange?: [number, number];
  resid: boolean; xLabel: string; yLabel: string; order: 1 | 2 | 3; band: boolean; stats: boolean;
  lowess: boolean;
  groups: {name: string; x: number[]; y: number[]; fit: PolyFit; /** The LOWESS curve (of the data, or of the residuals for residplot). */ smooth?: (x: number) => number}[];
}
const TONES: ChartTone[] = ['accent', 'danger', 'text', 'muted'], DASH = ['', '6,4', '2,4', '10,4,2,4'];

export function resolveReg(who: string, resid: boolean, data: RegData, opts: RegOpts): RegSpec {
  checkIds(who, [], opts.id);
  if (data === null || typeof data !== 'object' || !('x' in data) || !('y' in data)) fail(who, 'needs columns: {x: [..], y: [..]}');
  const order = opts.order ?? 1, lowess = !!opts.lowess;
  const frac = opts.frac ?? 2 / 3;
  if (!(frac > 0 && frac <= 1)) fail(who, `frac must be a number in (0, 1] (got ${String(opts.frac)})`);
  if (lowess && !resid && opts.stats) fail(who, 'stats (an equation and R²) needs a polynomial fit: it is not defined for lowess');
  if (lowess && !resid && opts.order !== undefined) fail(who, 'order and lowess are two ways to draw the curve: give one');
  if (![1, 2, 3].includes(order)) fail(who, `order must be 1, 2 or 3 (got ${String(opts.order)})`);
  const num = (what: string, v: readonly number[]) => { if (!Array.isArray(v) || v.length < 2) fail(who, `${what} needs at least two values`); return (v as number[]).map((q, i) => finiteNum(who, `${what} value ${i + 1}`, q)); };
  const x = num('x', data.x), y = num('y', data.y);
  if (x.length !== y.length) fail(who, `x has ${x.length} values and y has ${y.length}`);
  const labels = data.group ?? opts.groups;
  if (labels !== undefined && labels.length !== x.length) fail(who, `groups has ${labels.length} labels for ${x.length} rows`);
  const names = labels === undefined ? [''] : [...new Set(labels)];
  if (names.length > TONES.length) fail(who, `at most ${TONES.length} groups (got ${names.length}: ${names.join(', ')})`);
  if (labels !== undefined) names.forEach(n => checkText(who, 'a group label', n));
  const groups = names.map(name => {
    const idx = x.map((_q, i) => i).filter(i => labels === undefined || labels[i] === name), gx = idx.map(i => x[i]), gy = idx.map(i => y[i]);
    const label = name ? `"${name}"` : 'the data';
    if (gx.length < order + 2) fail(who, `${label}: a fit of order ${order} needs at least ${order + 2} points (got ${gx.length})`);
    if (new Set(gx).size < order + 1) fail(who, `${label}: the x values need at least ${order + 1} different values for a fit of order ${order}`);
    const fit = polyFit(gx, gy, order);
    return {name, x: gx, y: gy, fit, ...(lowess ? {smooth: lowessFit(gx, resid ? gy.map((v, i) => v - fit.at(gx[i])) : gy, frac)} : {})};
  });
  const range = (k: 'xRange' | 'yRange') => { const v = opts[k]; if (v === undefined) return {}; if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite) || !(v[0] < v[1])) fail(who, `${k} must be [min, max] with min < max (got ${JSON.stringify(v)})`); return {[k]: [v[0], v[1]]}; };
  return {...range('xRange'), ...range('yRange'), resid, xLabel: opts.xLabel ?? '', yLabel: opts.yLabel ?? '', order, band: opts.band ?? true, stats: !!opts.stats, lowess, groups};
}

const sgn = (v: number): string => `${v < 0 ? '−' : '+'} ${numText(Math.abs(parseFloat(v.toPrecision(3))))}`;
/** The text a fit is described by in the legend: "y = 0.55x − 32 (R² = 0.81)" for a line, "R² = 0.9" for a curve. */
function statText(s: RegSpec, fit: PolyFit, xs: number[], ys: number[]): string {
  const r2 = `R² = ${numText(parseFloat(fit.r2.toPrecision(2)))}`;
  if (s.order > 1 || s.resid) return r2;
  const mx = meanOf(xs), my = meanOf(ys), sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx, icpt = my - slope * mx;
  return `y = ${numText(parseFloat(slope.toPrecision(3)))}x ${sgn(icpt)}（${r2}）`;
}
const legendText = (s: RegSpec, g: RegSpec['groups'][number]): string => `${g.name}${g.name && s.stats ? ' ' : ''}${s.stats ? statText(s, g.fit, g.x, g.y) : ''}`;

export function regAlt(s: RegSpec): string {
  return `${s.resid ? (s.lowess ? '残差プロットとLOWESS平滑線' : '残差プロット') : s.lowess ? '散布図とLOWESS平滑線' : s.order === 1 ? '散布図と回帰直線' : `散布図と${s.order}次の回帰曲線`}（${s.xLabel || 'x'}・${s.yLabel || 'y'}）: ${s.groups.map(g => `${g.name ? g.name + ' ' : ''}n=${g.x.length} R²=${numText(parseFloat(g.fit.r2.toPrecision(2)))}`).join('、')}`;
}

interface Pts {x: number; y: number}
function curves(s: RegSpec, xs: {min: number; max: number}) {
  return s.groups.map(g => {
    const lo = Math.min(...g.x), hi = Math.max(...g.x);
    const grid = Array.from({length: 61}, (_q, i) => lo + (hi - lo) * i / 60);
    if (g.smooth && !s.resid) { const line = grid.map(x => ({x, y: (g.smooth as (x: number) => number)(x)})); return {fit: line, up: line, dn: line, pts: g.x.map((x, i) => ({x, y: g.y[i]}))}; }
    return {fit: grid.map(x => ({x, y: s.resid ? (g.smooth ? g.smooth(x) : 0) : g.fit.at(x)})), up: grid.map(x => ({x, y: g.fit.at(x) + (g.fit.half?.(x) ?? 0)})), dn: grid.map(x => ({x, y: g.fit.at(x) - (g.fit.half?.(x) ?? 0)})), pts: g.x.map((x, i) => ({x, y: s.resid ? g.y[i] - g.fit.at(x) : g.y[i]}))};
  }).map(c => ({...c, xs}));
}
function scales(s: RegSpec) {
  const all = s.groups.flatMap(g => g.x), xs = niceScale(Math.min(...all, s.xRange?.[0] ?? Infinity), Math.max(...all, s.xRange?.[1] ?? -Infinity)), cv = curves(s, xs);
  const ys = s.groups.flatMap((_g, i) => [...cv[i].pts.map(p => p.y), ...(s.resid ? [0, ...(s.lowess ? cv[i].fit.map(p => p.y) : [])] : s.band ? [...cv[i].up, ...cv[i].dn].map(p => p.y) : cv[i].fit.map(p => p.y))]);
  const top = Math.max(...ys.map(Math.abs)), yscale = s.resid ? niceScale(Math.min(-top, s.yRange?.[0] ?? 0), Math.max(top, s.yRange?.[1] ?? 0)) : niceScale(Math.min(...ys, s.yRange?.[0] ?? Infinity), Math.max(...ys, s.yRange?.[1] ?? -Infinity));
  return {xs, ys: yscale, cv};
}
/** The axes the figure ends up with (what a facet shares between panels). */
export function regAxes(s: RegSpec): {x: [number, number]; y: [number, number]} { const sc = scales(s); return {x: [sc.xs.min, sc.xs.max], y: [sc.ys.min, sc.ys.max]}; }
export function regTexts(s: RegSpec): [string, number][] {
  const sc = scales(s), out: [string, number][] = [];
  if (s.groups.length > 1 || s.stats) for (const g of s.groups) { const t = legendText(s, g); if (t) out.push([t, 400]); }
  if (s.xLabel) out.push([s.xLabel, 700]);
  out.push([s.yLabel || (s.resid ? '残差' : ''), 700]);
  for (const t of sc.xs.ticks) out.push([numText(t), 400]);
  for (const t of sc.ys.ticks) out.push([numText(t), 400]);
  return out.filter(([t]) => t);
}

export function layoutReg(s: RegSpec, g: ChartGeom): LaidOutChartPart {
  const who = s.resid ? 'residplot' : 'regplot';
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf, g.wrap), r1 = (v: number) => Math.round(v * 10) / 10, sc = scales(s);
  const tone = (i: number) => TONES[i] as 'accent';
  const entries = s.groups.map((gr, i) => ({i, text: legendText(s, gr)})).filter(e => e.text && (s.groups.length > 1 || s.stats));
  const legend: {x: number; row: number; i: number; text: string}[] = [];
  let lx = g.x, row = 0;
  for (const e of entries) { const w = 30 + 6 + c.tw(e.text) + 22; if (lx + w - 22 > g.x + g.w && lx > g.x) { lx = g.x; row++; } legend.push({x: lx, row, i: e.i, text: e.text}); lx += w; }
  const legendH = entries.length ? (row + 1) * (S + 12) : 0, yName = s.yLabel || (s.resid ? '残差' : ''), headH = legendH + (yName ? S + 10 : 0);
  const tickW = Math.max(...sc.ys.ticks.map(t => c.tw(numText(t))));
  const plotL = g.x + tickW + 16, plotR = g.x + g.w - Math.ceil(c.tw(numText(sc.xs.max)) / 2) - 6, axisH = S + 20 + (s.xLabel ? S + 10 : 0);
  if (plotR - plotL < 80) fail(who, 'the figure is too narrow for its labels (raise width)');
  c.h = g.height ?? 340 + headH;
  const plotT = g.y + headH + Math.ceil(S / 2) + 2, plotB = g.y + c.h - axisH - 6;
  if (plotB - plotT < 100) fail(who, 'the figure is too short; raise height');
  const xOf = (v: number) => plotL + (v - sc.xs.min) / (sc.xs.max - sc.xs.min) * (plotR - plotL), yOf = (v: number) => plotB - (v - sc.ys.min) / (sc.ys.max - sc.ys.min) * (plotB - plotT);
  const pt = (p: Pts) => `${r1(xOf(p.x))},${r1(yOf(p.y))}`, line = (ps: Pts[]) => ps.map((p, k) => `${k ? 'L' : 'M'}${pt(p)}`).join(' ');
  legend.forEach(l => {
    const cy = g.y + l.row * (S + 12) + Math.max(9, Math.ceil(S * 0.64));
    c.path(markerPath(SHAPES[l.i], l.x + 5, cy, 4.5), {fill: tone(l.i), op: 0.8});
    c.line(l.x + 12, cy, l.x + 30, cy, {stroke: tone(l.i), sw: 2, dash: DASH[l.i] || undefined});
    c.text(l.text, l.x + 36, c.mid(cy), 'start', 'text');
  });
  if (yName) c.text(yName, plotL - 4, g.y + legendH + S + 2, 'start', 'muted', {bold: true});
  for (const t of sc.ys.ticks) { c.line(plotL - 6, yOf(t), plotR, yOf(t), {stroke: t === 0 && s.resid ? 'text' : 'border'}); c.text(numText(t), plotL - 10, c.mid(yOf(t)), 'end', 'muted'); }
  for (const t of sc.xs.ticks) { c.line(xOf(t), plotB, xOf(t), plotB + 6, {stroke: 'border'}); c.text(numText(t), xOf(t), plotB + S + 14, 'middle', 'muted'); }
  c.line(plotL, plotT, plotL, plotB, {stroke: 'border'}); c.line(plotL, plotB, plotR, plotB, {stroke: s.resid ? 'border' : 'text'});
  if (s.xLabel) c.text(s.xLabel, (plotL + plotR) / 2, plotB + 2 * S + 26, 'middle', 'muted', {bold: true});
  const marks: Pts[] = [];
  s.groups.forEach((_gr, i) => {
    const cv = sc.cv[i];
    if (s.band && !s.resid && cv.up[0].y !== cv.fit[0].y) c.path(`${line(cv.up)} L${line([...cv.dn].reverse()).slice(1)} Z`, {fill: tone(i), op: 0.14});
    for (const p of cv.pts) { c.path(markerPath(SHAPES[i], xOf(p.x), yOf(p.y), 3.5), {fill: tone(i), op: 0.75, stroke: 'bg', sw: 1}); marks.push({x: xOf(p.x), y: yOf(p.y)}); }
    if (!s.resid || s.lowess) c.path(line(cv.fit), {fill: 'none', stroke: tone(i), sw: 2.5, dash: DASH[i] || undefined});
  });
  for (const m of marks) c.marks.push({x: m.x - 4, y: m.y - 4, w: 8, h: 8});
  if (s.resid) c.line(plotL, yOf(0), plotR, yOf(0), {stroke: 'text', sw: 2, dash: '6,4'});
  void Canvas;
  return c.done();
}
