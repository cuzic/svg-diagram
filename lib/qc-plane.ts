// scatter() and controlChart(): the QC tools that are points and lines on a coordinate plane. Both only work out a plane() — axes that
// fit the data, the points, the lines, the labels — so layout, verify and every other check treat them as any plane.
import {niceNear, num} from './qc.ts';
import type {PlaneAxis, PlaneLabel, PlaneLine, PlaneOpts, PlanePath, PlanePoint, PlanePos, PlaneTone} from './types.ts';

/** How wide a text is, roughly (before layout knows the fonts): full-width characters take the whole size, the others 0.6 of it. */
const estimate = (s: string, size = 14): number => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? size : size * 0.6), 0);
/** The plot's rough size in px, to turn pixel room (a legend row, a label beside a line) into units of an axis. */
const PLOT_W = 800, PLOT_H = (h: number) => Math.max(120, h - 60);

const unitsFor = (px: number, range: number, plotPx: number): number => px / plotPx * range;

/** An axis over [lo, hi] with round ticks, `head` extra units above the last tick (room for a legend), and `tail` below the first. */
function fitAxis(lo: number, hi: number, label: string | undefined, fixed: {min?: number; max?: number; step?: number} = {}, room: {head?: number} = {}): PlaneAxis {
  const span = hi - lo || Math.abs(hi) || 1, step = fixed.step ?? niceNear(span / 6);
  const min = fixed.min ?? Math.floor((lo - span * 0.04) / step + 1e-9) * step, top = fixed.max ?? Math.ceil((hi + span * 0.04) / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = min, i = 0; v <= top + step * 1e-9 && i < 200; v = min + ++i * step) ticks.push(parseFloat(v.toPrecision(12)));
  return {...(label ? {label} : {}), min, max: top + (room.head ?? 0), step, ticks};
}

// ---- legend rows -------------------------------------------------------------------------------------------------------------

const GLYPH: Record<'dot' | 'ring' | 'cross', string> = {dot: '●', ring: '○', cross: '✕'};
export interface LegendEntry {text: string; tone: PlaneTone; shape?: 'dot' | 'ring' | 'cross'}

/** One row of legend entries in the room above the data, from the left edge, each as wide as its text. */
function legendRow(entries: LegendEntry[], x0: number, xRange: number, y: number): PlaneLabel[] {
  const out: PlaneLabel[] = [];
  let at = x0;
  for (const e of entries) {
    const text = `${e.shape ? GLYPH[e.shape] + ' ' : ''}${e.text}`;
    out.push({at: [at, y], text, anchor: 'start', tone: e.tone});
    at += unitsFor(estimate(text, 14) + 28, xRange, PLOT_W);
  }
  return out;
}

// ---- scatter -----------------------------------------------------------------------------------------------------------------

export interface ScatterPoint {x: number; y: number; /** Written beside the point. */ label?: string; /** The stratum the point belongs to: each gets its own colour and shape. */ group?: string; id?: string}
export interface ScatterOpts extends Omit<PlaneOpts, 'x' | 'y' | 'points' | 'lines' | 'paths' | 'dims' | 'labels' | 'yDown'> {
  /** The axis names (a string), or an axis with its own range. */
  x: string | (Omit<PlaneAxis, 'max'> & {max?: number});
  y: string | (Omit<PlaneAxis, 'max'> & {max?: number});
  /** Draw the least-squares line and write the correlation coefficient. */
  regression?: boolean;
  /** The order of the strata (default: as they first appear in the points). Up to 4. */
  groups?: string[];
}
/** Colour + shape of the 1st to the 4th stratum: the shape differs too, so the strata stay apart without colour. */
const STRATA: {tone: PlaneTone; shape: 'dot' | 'ring' | 'cross'}[] = [{tone: 'accent', shape: 'dot'}, {tone: 'danger', shape: 'cross'}, {tone: 'text', shape: 'ring'}, {tone: 'muted', shape: 'dot'}];

export function correlation(xs: readonly number[], ys: readonly number[]): {r: number; slope: number; intercept: number} {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const slope = sxx > 0 ? sxy / sxx : 0;
  return {r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0, slope, intercept: my - slope * mx};
}

export function scatterOpts(points: readonly ScatterPoint[], opts: ScatterOpts): PlaneOpts {
  if (!Array.isArray(points) || points.length < 2) throw new Error('scatter(points) needs at least two points');
  for (const [i, p] of points.entries()) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`scatter(): point ${i + 1} needs a finite x and y (got ${p.x}, ${p.y})`);
  const groups = opts.groups ?? [...new Set(points.flatMap(p => p.group === undefined ? [] : [p.group]))];
  if (groups.length > STRATA.length) throw new Error(`scatter(): at most ${STRATA.length} strata (got ${groups.length}: ${groups.join(', ')})`);
  for (const p of points) if (p.group !== undefined && !groups.includes(p.group)) throw new Error(`scatter(): a point has group "${p.group}", which is not in groups (${groups.join(', ')})`);
  if (groups.length && points.some(p => p.group === undefined)) throw new Error('scatter(): when some points have a group, every point needs one');
  const axisOf = (a: ScatterOpts['x']) => typeof a === 'string' ? {label: a} : a;
  const ax = axisOf(opts.x), ay = axisOf(opts.y);
  const xs = points.map(p => p.x), ys = points.map(p => p.y), {r, slope, intercept} = correlation(xs, ys);
  const notes = groups.length > 1 || !!opts.regression;
  const height = opts.height ?? 320;
  const probe = fitAxis(Math.min(...ys), Math.max(...ys), undefined, {min: ay.min, max: ay.max, step: ay.step});
  const head = notes ? unitsFor(34, probe.max - (probe.min ?? 0), PLOT_H(height)) : 0;
  const x = fitAxis(Math.min(...xs), Math.max(...xs), ax.label, {min: ax.min, max: ax.max, step: ax.step});
  const y = fitAxis(Math.min(...ys), Math.max(...ys), ay.label, {min: ay.min, max: ay.max, step: ay.step}, {head});
  if (ax.ticks) x.ticks = ax.ticks; if (ay.ticks) y.ticks = ay.ticks;
  const xMin = x.min ?? 0, yTop = y.max - head, labelY = y.max - head * 0.45;
  const {labelRole, id, reveal, until, width} = opts as PlaneOpts;
  const pts: PlanePoint[] = points.map(p => {
    const s = p.group === undefined ? STRATA[0] : STRATA[groups.indexOf(p.group)];
    return {at: [p.x, p.y] as PlanePos, ...(p.id ? {id: p.id} : {}), ...(p.label ? {label: p.label} : {}), tone: s.tone, shape: s.shape};
  });
  const lines: PlaneLine[] = [], labels: PlaneLabel[] = [];
  if (groups.length > 1) labels.push(...legendRow(groups.map((g, i) => ({text: g, ...STRATA[i]})), xMin + (x.max - xMin) * 0.01, x.max - xMin, labelY));
  if (opts.regression) {
    // the line over the data's x range, cut where it would leave the plot
    let x1 = Math.min(...xs), x2 = Math.max(...xs);
    if (slope !== 0) {
      const at = (yy: number) => (yy - intercept) / slope;
      const lo = Math.min(at(y.min ?? 0), at(yTop)), hi = Math.max(at(y.min ?? 0), at(yTop));
      x1 = Math.max(x1, lo); x2 = Math.min(x2, hi);
    }
    if (x1 < x2) lines.push({from: [x1, intercept + slope * x1], to: [x2, intercept + slope * x2], tone: 'muted', dashed: true});
    labels.push({at: [x.max - (x.max - xMin) * 0.01, labelY], anchor: 'end', tone: 'text', bold: true, text: `r = ${(Math.round(r * 100) / 100).toFixed(2)}　y = ${num(slope)}x ${intercept < 0 ? '−' : '+'} ${num(Math.abs(intercept))}　n = ${points.length}`});
  }
  return {...(labelRole ? {labelRole} : {}), ...(id ? {id} : {}), ...(reveal === undefined ? {} : {reveal}), ...(until === undefined ? {} : {until}), ...(width === undefined ? {} : {width}), x, y, points: pts, lines, labels, height, grid: opts.grid ?? true};
}

// ---- control charts ----------------------------------------------------------------------------------------------------------

/** The factors for subgroups of size n = 2..10: A2 (X-bar limits from R-bar), D3 / D4 (R chart limits), d2. */
const FACTORS: Record<number, {A2: number; D3: number; D4: number}> = {
  2: {A2: 1.88, D3: 0, D4: 3.267}, 3: {A2: 1.023, D3: 0, D4: 2.575}, 4: {A2: 0.729, D3: 0, D4: 2.282}, 5: {A2: 0.577, D3: 0, D4: 2.114},
  6: {A2: 0.483, D3: 0, D4: 2.004}, 7: {A2: 0.419, D3: 0.076, D4: 1.924}, 8: {A2: 0.373, D3: 0.136, D4: 1.864}, 9: {A2: 0.337, D3: 0.184, D4: 1.816},
  10: {A2: 0.308, D3: 0.223, D4: 1.777},
};
/** The factor 3 / d2 for individuals (moving ranges of 2). */
const E2 = 2.66, D4_MR = 3.267;

export type ControlType = 'x' | 'mr' | 'xbar' | 'r' | 'p' | 'np' | 'c' | 'u';
/** A subgroup of an attribute chart: `n` inspected (or the size of the area, for u), `d` found defective (or defects). */
export interface AttributeSample {n: number; d: number}
export interface ControlChartOpts extends Omit<PlaneOpts, 'x' | 'y' | 'points' | 'lines' | 'paths' | 'dims' | 'labels' | 'yDown'> {
  /** The name of the horizontal axis (default 'サンプル'). */
  xLabel?: string;
  /** The name of the vertical axis (default by chart type). */
  yLabel?: string;
  /** What to write under the numbers 1..N on the axis (dates, lot names); one per sample. */
  at?: string[];
  /** Fixed limits (from an earlier stable period) instead of the ones worked out from this data. */
  limits?: {cl?: number; ucl?: number; lcl?: number};
  /** Mark the points that break a rule: outside the limits (red cross), 7 in a row on one side of the centre line or 7 in a row rising / falling (red ring). Default true. */
  rules?: boolean;
  /** Decimal places of the limit labels (default: 3 significant digits). */
  digits?: number;
}

export interface ControlStats {cl: number; ucl: number[]; lcl: number[]; values: number[]}
/** What a chart plots and where its centre and limits are, from the data. */
export function controlStats(type: ControlType, data: readonly (number | number[] | AttributeSample)[], fixed: ControlChartOpts['limits'] = {}): ControlStats {
  const N = data.length;
  if (N < 2) throw new Error(`controlChart(): needs at least two samples (got ${N})`);
  const flat = (k: string) => {
    if (!data.every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error(`controlChart('${type}'): each sample must be a number (${k})`);
    return data as number[];
  };
  const groups = (): number[][] => {
    const g = data as number[][];
    if (!g.every(s => Array.isArray(s) && s.length >= 2 && s.every(Number.isFinite))) throw new Error(`controlChart('${type}'): each sample must be a subgroup: an array of at least two numbers`);
    const n = g[0].length;
    if (!g.every(s => s.length === n)) throw new Error(`controlChart('${type}'): every subgroup must have the same size (got ${[...new Set(g.map(s => s.length))].join(', ')})`);
    if (!(n in FACTORS)) throw new Error(`controlChart('${type}'): the subgroup size must be 2 to 10 (got ${n})`);
    return g;
  };
  const attrs = (): AttributeSample[] => {
    const a = data as AttributeSample[];
    if (!a.every(s => s && Number.isFinite(s.n) && Number.isFinite(s.d) && s.n > 0 && s.d >= 0 && s.d <= s.n * (type === 'u' ? Infinity : 1))) throw new Error(`controlChart('${type}'): each sample must be {n, d} with n > 0 and 0 <= d${type === 'u' ? '' : ' <= n'}`);
    return a;
  };
  const same = (cl: number, w: number | number[], lo0 = -Infinity): ControlStats['ucl'] extends number[] ? Pick<ControlStats, 'ucl' | 'lcl'> : never => {
    const ws = typeof w === 'number' ? new Array<number>(N).fill(w) : w;
    return {ucl: ws.map(x => cl + x), lcl: ws.map(x => Math.max(lo0, cl - x))} as never;
  };
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  let cl: number, values: number[], ucl: number[], lcl: number[];
  switch (type) {
    case 'x': {
      values = flat('x');
      const mr = values.slice(1).map((v, i) => Math.abs(v - values[i])), mrBar = sum(mr) / mr.length;
      cl = sum(values) / N; ({ucl, lcl} = same(cl, E2 * mrBar)); break;
    }
    case 'mr': {
      const v = flat('mr');
      values = v.slice(1).map((x, i) => Math.abs(x - v[i])); cl = sum(values) / values.length;
      ucl = new Array<number>(values.length).fill(D4_MR * cl); lcl = new Array<number>(values.length).fill(0); break;
    }
    case 'xbar': case 'r': {
      const g = groups(), n = g[0].length, f = FACTORS[n];
      const means = g.map(s => sum(s) / n), ranges = g.map(s => Math.max(...s) - Math.min(...s)), rBar = sum(ranges) / N;
      if (type === 'xbar') { values = means; cl = sum(means) / N; ({ucl, lcl} = same(cl, f.A2 * rBar)); }
      else { values = ranges; cl = rBar; ucl = new Array<number>(N).fill(f.D4 * rBar); lcl = new Array<number>(N).fill(f.D3 * rBar); }
      break;
    }
    case 'p': {
      const a = attrs(); values = a.map(s => s.d / s.n); cl = sum(a.map(s => s.d)) / sum(a.map(s => s.n));
      ({ucl, lcl} = same(cl, a.map(s => 3 * Math.sqrt(cl * (1 - cl) / s.n)), 0)); ucl = ucl.map(u => Math.min(1, u)); break;
    }
    case 'np': {
      const a = attrs(), n = a[0].n;
      if (!a.every(s => s.n === n)) throw new Error("controlChart('np'): every sample must inspect the same number (use 'p' when n varies)");
      const p = sum(a.map(s => s.d)) / sum(a.map(s => s.n)); values = a.map(s => s.d); cl = n * p;
      ({ucl, lcl} = same(cl, 3 * Math.sqrt(n * p * (1 - p)), 0)); break;
    }
    case 'c': {
      values = flat('c'); cl = sum(values) / N; ({ucl, lcl} = same(cl, 3 * Math.sqrt(cl), 0)); break;
    }
    case 'u': {
      const a = attrs(); values = a.map(s => s.d / s.n); cl = sum(a.map(s => s.d)) / sum(a.map(s => s.n));
      ({ucl, lcl} = same(cl, a.map(s => 3 * Math.sqrt(cl / s.n)), 0)); break;
    }
    default: throw new Error(`controlChart(): type must be one of x, mr, xbar, r, p, np, c, u (got ${String(type)})`);
  }
  if (fixed.cl !== undefined) cl = fixed.cl;
  if (fixed.ucl !== undefined) ucl = ucl.map(() => fixed.ucl!);
  if (fixed.lcl !== undefined) lcl = lcl.map(() => fixed.lcl!);
  return {cl, ucl, lcl, values};
}

const Y_LABEL: Record<ControlType, string> = {x: '測定値 X', mr: '移動範囲 Rs', xbar: '群の平均', r: '範囲 R', p: '不良率 p', np: '不良数 np', c: '欠点数 c', u: '単位あたり欠点数 u'};
const RUN = 7;

/** The indices that break a rule: [outside the limits, in a run or a trend]. */
export function controlSignals(s: ControlStats): {outside: Set<number>; pattern: Set<number>} {
  const outside = new Set<number>(), pattern = new Set<number>(), v = s.values;
  v.forEach((x, i) => { if (x > s.ucl[i] + 1e-12 || x < s.lcl[i] - 1e-12) outside.add(i); });
  const side = v.map(x => Math.sign(x - s.cl));
  for (let i = 0; i + RUN <= v.length; i++) {
    const w = side.slice(i, i + RUN);
    if (w[0] !== 0 && w.every(t => t === w[0])) for (let k = i; k < i + RUN; k++) pattern.add(k);
    const d = v.slice(i + 1, i + RUN).map((x, k) => Math.sign(x - v[i + k]));
    if (d[0] !== 0 && d.every(t => t === d[0])) for (let k = i; k < i + RUN; k++) pattern.add(k);
  }
  return {outside, pattern};
}

export function controlChartOpts(type: ControlType, data: readonly (number | number[] | AttributeSample)[], opts: ControlChartOpts = {}): PlaneOpts {
  const s = controlStats(type, data, opts.limits), n = s.values.length;
  if (opts.at && opts.at.length !== (type === 'mr' ? data.length : n)) throw new Error(`controlChart(): at needs one label per sample (${data.length}), got ${opts.at.length}`);
  const offset = type === 'mr' ? 1 : 0; // a moving range belongs to the sample it ends at, so it starts at 2
  const flagged = opts.rules === false ? {outside: new Set<number>(), pattern: new Set<number>()} : controlSignals(s);
  const height = opts.height ?? 320;
  const lo = Math.min(...s.values, ...s.lcl), hi = Math.max(...s.values, ...s.ucl);
  const legend: LegendEntry[] = [];
  if (flagged.outside.size) legend.push({text: '管理限界の外', tone: 'danger', shape: 'cross'});
  if ([...flagged.pattern].some(i => !flagged.outside.has(i))) legend.push({text: `連・傾向（${RUN} 点）`, tone: 'danger', shape: 'ring'});
  const probe = fitAxis(lo, hi, undefined);
  const head = legend.length ? unitsFor(34, probe.max - (probe.min ?? 0), PLOT_H(height)) : 0;
  const y = fitAxis(lo, hi, opts.yLabel ?? Y_LABEL[type], {min: type === 'x' || type === 'xbar' ? undefined : 0}, {head});
  if (type !== 'x' && type !== 'xbar' && lo >= 0) y.min = 0;
  const N = n + offset;
  const room = Math.ceil((estimate('UCL 00.0', 14) + 16) / PLOT_W * (N + 1)) + 1; // the labels beside the right end of the lines
  const every = N > 30 ? 5 : N > 16 ? 2 : 1;
  const xTicks = Array.from({length: N}, (_, i) => i + 1).filter(i => (i - 1) % every === 0 || i === N).map(i => opts.at ? {at: i, label: opts.at[i - 1]} : i);
  const x: PlaneAxis = {label: opts.xLabel ?? 'サンプル', min: 0, max: N + 1 + room, ticks: xTicks};
  // as many decimals as it takes to tell the limits from the centre line (about 3 digits of the spread between them)
  const spread = Math.max(...s.ucl) - Math.min(s.cl, ...s.lcl), places = opts.digits ?? (spread > 0 ? Math.max(0, 1 - Math.floor(Math.log10(spread))) : 2);
  const fmt = (v: number) => v.toFixed(places);
  const pt = (i: number): PlanePos => [i + 1 + offset, s.values[i]];
  const points: PlanePoint[] = s.values.map((_, i) => ({at: pt(i), tone: flagged.outside.has(i) || flagged.pattern.has(i) ? 'danger' : 'accent', shape: flagged.outside.has(i) ? 'cross' : flagged.pattern.has(i) ? 'ring' : 'dot'}));
  const edge = (arr: number[]): PlanePos[] => {
    // constant limits are one line; limits that vary with n step from sample to sample
    if (arr.every(v => Math.abs(v - arr[0]) < 1e-12)) return [[0.5 + offset, arr[0]], [N + 0.5, arr[0]]];
    const out: PlanePos[] = [];
    arr.forEach((v, i) => { out.push([i + 0.5 + offset, v], [i + 1.5 + offset, v]); });
    return out;
  };
  const paths: PlanePath[] = [{through: points.map(p => p.at as PlanePos)}];
  const lines: PlaneLine[] = [{from: [0.5 + offset, s.cl], to: [N + 0.5, s.cl], tone: 'accent', dashed: false}];
  const labels: PlaneLabel[] = [];
  const labelX = N + 0.8, gapY = unitsFor(18, y.max - (y.min ?? 0) - head, PLOT_H(height));
  const hasLcl = s.lcl.some(v => v > 1e-12 || type === 'x' || type === 'xbar');
  const rows: {text: string; at: number}[] = [{text: `UCL ${fmt(s.ucl[n - 1])}`, at: s.ucl[n - 1]}, {text: `CL ${fmt(s.cl)}`, at: s.cl}];
  if (hasLcl) rows.push({text: `LCL ${fmt(s.lcl[n - 1])}`, at: s.lcl[n - 1]});
  for (const [name, arr] of [['ucl', s.ucl], ['lcl', s.lcl]] as const) {
    if (name === 'lcl' && !hasLcl) continue;
    const e = edge(arr);
    if (e.length === 2) lines.push({from: e[0], to: e[1], tone: 'danger', dashed: true});
    else paths.push({through: e, tone: 'danger', dashed: true});
  }
  // labels of lines that sit closer than a text's height are pushed apart, so none of them touches another
  const placed = rows.sort((a, b) => b.at - a.at);
  for (let i = 1; i < placed.length; i++) if (placed[i - 1].at - placed[i].at < gapY) placed[i] = {...placed[i], at: placed[i - 1].at - gapY};
  for (const r of placed) labels.push({at: [labelX, r.at], text: r.text, anchor: 'start', tone: r.text.startsWith('CL') ? 'accent' : 'danger', bold: true});
  const flagLabels = legend.length ? legendRow(legend, 0.5, x.max, y.max - head * 0.45) : [];
  const {labelRole, id, reveal, until, width} = opts as PlaneOpts;
  return {...(labelRole ? {labelRole} : {}), ...(id ? {id} : {}), ...(reveal === undefined ? {} : {reveal}), ...(until === undefined ? {} : {until}), ...(width === undefined ? {} : {width}), x, y, points, paths, lines, labels: [...labels, ...flagLabels], height};
}
