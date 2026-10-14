import {decimalsOf, exact, histogramBins, mean, niceUp, normalCount, paretoOrder, sd} from '../qc.ts';
import {scatterOpts} from '../qc-plane.ts';
import type {ScatterOpts, ScatterPoint} from '../qc-plane.ts';
import {LABEL_ROLES} from '../tokens.ts';
import type {BarDatum, BarsBand, BarsLine, BarsOpts} from '../types/bars.ts';
import type {PlaneBand} from '../types/figures.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {plane} from './figures.ts';
import {assertTextRole, revealOf, withAnchors, withHandle} from './shared.ts';

/** The overlay options of bars(): reference lines, the cumulative line, the curve and the edge labels. */
function validateBarsOverlays(data: readonly BarDatum[], opts: BarsOpts, max: number): void {
  const tones = ['accent', 'danger', 'muted', 'text'];
  const count = new Set(data.map((d, i) => d.replaces ?? d.id ?? i)).size;
  for (const [key, list] of [['lines', opts.lines], ['vlines', opts.vlines]] as const) for (const [i, l] of (list ?? []).entries()) {
    if (!Number.isFinite(l.at)) throw new Error(`bars(): ${key}[${i}].at must be a finite number (got ${l.at})`);
    if (key === 'lines' && !(l.at >= 0 && l.at <= max)) throw new Error(`bars(): lines[${i}].at ${l.at} is outside the bars' axis 0-${max}`);
    if (key === 'vlines' && !(l.at >= -1e-9 && l.at <= data.length + 1e-9)) throw new Error(`bars(): vlines[${i}].at ${l.at} is outside the bars (0 is the left edge of the first bar, ${data.length} the right edge of the last)`);
    if (l.tone !== undefined && !tones.includes(l.tone)) throw new Error(`bars(): ${key}[${i}].tone must be one of ${tones.join(', ')} (got ${String(l.tone)})`);
    if (l.label !== undefined && !l.label.trim()) throw new Error(`bars(): ${key}[${i}].label is empty`);
  }
  if (opts.curve) {
    const pts = opts.curve.through;
    if (!Array.isArray(pts) || pts.length < 2 || pts.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) throw new Error('bars(): curve.through needs at least two [slot position, value] points');
    if (pts.some(([sx, v]) => sx < 0 || sx > data.length || v < 0 || v > max)) throw new Error(`bars(): curve.through has a point outside the bars (slot 0-${data.length}, value 0-${max})`);
  }
  if (opts.cumulative) {
    const total = data.reduce((n, d) => n + d.value, 0);
    if (Math.abs(max - total) > total * 1e-9) throw new Error(`bars(): cumulative needs max to be the total (${total}), so that 100% is the top of the plot (got max ${max})`);
    if (data.some(d => d.replaces !== undefined)) throw new Error('bars(): cumulative does not work with replaces');
    const g = opts.cumulative.guide;
    if (g !== undefined && !(g > 0 && g < 100)) throw new Error(`bars(): cumulative.guide must be a percent between 0 and 100 (got ${g})`);
  }
  if (opts.edges) {
    if (opts.edges.length !== count + 1) throw new Error(`bars(): edges needs ${count + 1} labels for ${count} bars (got ${opts.edges.length})`);
    if (opts.labels === 'none') throw new Error("bars(): edges is a category label — it cannot be used with labels: 'none'");
  }
}
type BarIds<D extends readonly BarDatum[]> = Extract<D[number]['id'], string>;
export function bars<const D extends readonly BarDatum[], const Id extends string = never>(data: D, opts?: BarsOpts & {id?: Id}): BarsBand & Declares<Id | BarIds<D>> & HandleOf<Id> & AnchorsOf<BarIds<D>>;
export function bars(data: readonly BarDatum[], opts: BarsOpts = {}): BarsBand {
  assertTextRole(opts.labelRole, LABEL_ROLES, 'bars() labelRole');
  if (!Array.isArray(data) || data.length === 0) throw new Error('bars(data) needs at least one value');
  if (opts.height !== undefined && (!(opts.height > 0) || !Number.isFinite(opts.height))) throw new Error(`bars(): height must be a finite number > 0 (got ${opts.height})`);
  for (const d of data) {
    if (!Number.isFinite(d.value)) throw new Error(`bars(): value for "${d.label}" must be finite (got ${d.value})`);
    if (d.value < 0) throw new Error(`bars(): value for "${d.label}" must be >= 0 (got ${d.value})`);
    if (d.series !== undefined && !['a', 'b', 'c'].includes(d.series)) throw new Error(`bars(): series for "${d.label}" must be a, b, or c (got ${d.series})`);
    if (d.tone !== undefined && !['accent', 'danger', 'muted'].includes(d.tone)) throw new Error(`bars(): tone for "${d.label}" must be accent, danger, or muted (got ${d.tone})`);
    if (d.tone !== undefined && d.series !== undefined) throw new Error(`bars(): "${d.label}" has both series and tone; use one`);
  }
  if (opts.dir !== undefined && opts.dir !== 'h' && opts.dir !== 'v') throw new Error(`bars(): dir must be 'h' or 'v' (got ${opts.dir})`);
  if (data.every(d => d.value === 0)) throw new Error('bars(): all values are 0');
  if (opts.labels !== undefined && !['all', 'category', 'none'].includes(opts.labels)) throw new Error(`bars(): labels must be 'all', 'category' or 'none' (got ${opts.labels})`);
  for (const k of ['axis', 'grid', 'baseline'] as const) if (opts[k] !== undefined && typeof opts[k] !== 'boolean') throw new Error(`bars(): ${k} must be true or false (got ${opts[k]})`);
  if (opts.axis === false && opts.grid === true) throw new Error('bars(): grid needs axis (axis: false removes the ticks the grid lines belong to)');
  if (opts.valueFormat !== undefined && opts.valueFormat !== 'exact' && typeof opts.valueFormat !== 'function' && !(Number.isInteger(opts.valueFormat) && opts.valueFormat >= 0 && opts.valueFormat <= 6)) throw new Error(`bars(): valueFormat must be 'exact', a number of decimals (0-6) or a function (got ${opts.valueFormat})`);
  if (opts.barRatio !== undefined && !(opts.barRatio > 0 && opts.barRatio <= 1)) throw new Error(`bars(): barRatio must be a number > 0 and <= 1 (got ${opts.barRatio})`);
  if (opts.barRatio !== undefined && opts.stack) throw new Error('bars(): barRatio does not apply to stack');
  const stack = !!opts.stack;
  const overlay = (['lines', 'vlines', 'curve', 'cumulative', 'edges'] as const).filter(k => opts[k] !== undefined);
  if (overlay.length && (opts.dir !== 'v' || stack)) throw new Error(`bars(): ${overlay.join(' / ')} need vertical bars that are not stacked (dir: 'v')`);
  const extent = stack ? data.reduce((n, d) => n + d.value, 0) : Math.max(...data.map(d => d.value));
  const max = opts.max ?? extent;
  if (!(max > 0) || !Number.isFinite(max)) throw new Error(`bars(): max must be a finite number > 0 (got ${max})`);
  if (extent > max) throw new Error(`bars(): ${stack ? 'stack total' : 'a value'} (${extent}) exceeds max (${max})`);
  validateBarsOverlays(data, opts, max);
  const ids = data.map(d => d.id).filter((id): id is string => !!id);
  if (new Set(ids).size !== ids.length) throw new Error('bars(): each id must be unique');
  if (opts.id !== undefined && ids.includes(opts.id)) throw new Error(`bars(): the band's id "${opts.id}" is also a bar's id — each id must be unique`);
  const band: BarsBand = {type: 'bars', data: [...data], max, unit: opts.unit, dir: opts.dir ?? 'h', stack, height: opts.height, ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)};
  for (const k of ['labels', 'axis', 'grid', 'baseline', 'barRatio', 'labelRole', 'hideZero', 'lines', 'vlines', 'curve', 'cumulative', 'edges', 'valueFormat'] as const) if (opts[k] !== undefined) Object.assign(band, {[k]: opts[k]});
  return withHandle(withAnchors(band, data.map(d => d.id)), opts.id);
}
export interface ParetoOpts extends Omit<BarsOpts, 'dir' | 'stack' | 'cumulative' | 'lines' | 'vlines' | 'curve' | 'edges' | 'max'> {
  /** Keep the largest N items and fold the rest into `other`. */
  top?: number;
  /** The label of the fold-in item, always last whatever its size (default 'その他'). */
  other?: string;
  /** Draw a dashed line at this cumulative percent (default 80; `false`: none). */
  guide?: number | false;
  /** Colour the leading items that reach the guide percent (the vital few) and mute the rest (default true). */
  highlight?: boolean;
}
/**
 * A Pareto chart (パレート図): the items as bars in descending order, the "other" item last, and a cumulative line on a 0-100% axis
 * on the right. The items that reach 80% are coloured (`highlight: false` to keep one colour). `top: 5` folds the rest into 'その他'.
 *   pareto([{label: '傷', value: 42}, {label: '汚れ', value: 25}, {label: '欠け', value: 12}, {label: 'その他', value: 6}], {unit: '件'})
 */
export function pareto<const Id extends string = never>(items: readonly {label: string; value: number; id?: string}[], opts: ParetoOpts & {id?: Id} = {}): BarsBand & Declares<Id> & HandleOf<Id> {
  if (!Array.isArray(items) || items.length === 0) throw new Error('pareto(items) needs at least one item');
  for (const i of items) if (!Number.isFinite(i.value) || i.value < 0) throw new Error(`pareto(): value for "${i.label}" must be a finite number >= 0 (got ${i.value})`);
  if (items.every(i => i.value === 0)) throw new Error('pareto(): all values are 0');
  { const seen = new Set<string>(); for (const i of items) { if (seen.has(i.label)) throw new Error(`pareto(): the label "${i.label}" is written twice (add the two values, or tell them apart)`); seen.add(i.label); } }
  if (opts.top !== undefined && !(Number.isInteger(opts.top) && opts.top >= 1)) throw new Error(`pareto(): top must be a whole number >= 1 (got ${opts.top})`);
  const guide = opts.guide === false ? undefined : opts.guide ?? 80;
  const {items: ordered, vital} = paretoOrder(items, {top: opts.top, other: opts.other, reach: guide ?? 80});
  const total = ordered.reduce((n, i) => n + i.value, 0), ids = new Map(items.map(i => [i.label, i.id]));
  const {top: _t, other: _o, guide: _g, highlight, ...rest} = opts;
  const data: BarDatum[] = ordered.map((i, k) => ({label: i.label, value: i.value, ...(ids.get(i.label) ? {id: ids.get(i.label)} : {}), ...(highlight === false ? {} : k < vital ? {} : {series: 'c' as const})}));
  return bars(data, {...rest, dir: 'v', barRatio: 1, max: total, cumulative: guide === undefined ? {} : {guide}}) as never;
}
export interface HistogramOpts extends Omit<BarsOpts, 'dir' | 'stack' | 'cumulative' | 'lines' | 'vlines' | 'curve' | 'edges' | 'max' | 'barRatio'> {
  /** About how many classes (Sturges' rule when omitted). The class width is a round number. */
  bins?: number;
  /** The class width. */
  width?: number;
  /** Specification limits: dashed lines, and the classes beyond them are red. */
  lsl?: number;
  usl?: number;
  /** A target (nominal) value line. */
  target?: number;
  /** Draw the mean (default true). */
  mean?: boolean;
  /** Draw the normal curve with the data's mean and standard deviation. */
  normal?: boolean;
}
/**
 * A histogram (ヒストグラム) of raw measurements: the class width is a round number, the bars touch, the class boundaries are written
 * under the bars. `lsl` / `usl` draw the specification limits and turn the classes outside them red; the mean is drawn by default.
 *   histogram([9.8, 10.1, 10.0, 10.3, 9.9, ...], {lsl: 9.5, usl: 10.5, unit: '個'})
 */
export function histogram<const Id extends string = never>(values: readonly number[], opts: HistogramOpts & {id?: Id} = {}): BarsBand & Declares<Id> & HandleOf<Id> {
  if (!Array.isArray(values) || values.length < 2) throw new Error('histogram(values) needs at least two values');
  if (!values.every(Number.isFinite)) throw new Error('histogram(): every value must be a finite number');
  for (const k of ['lsl', 'usl', 'target', 'width'] as const) if (opts[k] !== undefined && !Number.isFinite(opts[k])) throw new Error(`histogram(): ${k} must be a finite number (got ${opts[k]})`);
  if (opts.width !== undefined && !(opts.width > 0)) throw new Error(`histogram(): width must be > 0 (got ${opts.width})`);
  if (opts.bins !== undefined && opts.width !== undefined) throw new Error('histogram(): give bins or width, not both');
  if (opts.bins !== undefined && !(Number.isInteger(opts.bins) && opts.bins >= 1)) throw new Error(`histogram(): bins must be a whole number >= 1 (got ${opts.bins})`);
  if (opts.lsl !== undefined && opts.usl !== undefined && !(opts.lsl < opts.usl)) throw new Error(`histogram(): lsl (${opts.lsl}) must be below usl (${opts.usl})`);
  const marks = [opts.lsl, opts.usl, opts.target].filter((v): v is number => v !== undefined);
  const {edges, counts, width} = histogramBins(values, {bins: opts.bins, width: opts.width, include: marks});
  const m = mean(values), s = sd(values), n = values.length;
  const slot = (v: number) => parseFloat(((v - edges[0]) / width).toPrecision(12));
  const out = (k: number) => (opts.lsl !== undefined && edges[k + 1] <= opts.lsl + 1e-9) || (opts.usl !== undefined && edges[k] >= opts.usl - 1e-9);
  const peak = opts.normal ? normalCount(m, m, s, n, width) : 0;
  const max = niceMax(Math.max(...counts, peak));
  const {bins: _b, width: _w, lsl, usl, target, mean: showMean, normal, ...rest} = opts;
  const lines: BarsLine[] = [];
  if (lsl !== undefined) lines.push({at: slot(lsl), label: `下限 ${exact(lsl)}`});
  if (target !== undefined) lines.push({at: slot(target), label: `目標 ${exact(target)}`, tone: 'muted'});
  if (usl !== undefined) lines.push({at: slot(usl), label: `上限 ${exact(usl)}`});
  if (showMean !== false) lines.push({at: slot(m), label: `平均 ${m.toFixed(decimalsOf(width) + 1)}`, tone: 'accent'});
  const every = labelEvery(edges.map(exact));
  const curve = normal && s > 0 ? {through: Array.from({length: 41}, (_, i) => { const sx = i / 40 * counts.length; return [sx, normalCount(edges[0] + sx * width, m, s, n, width)] as [number, number]; }), tone: 'text' as const} : undefined;
  return bars(counts.map((c, k) => ({label: `${exact(edges[k])}-${exact(edges[k + 1])}`, value: c, ...(out(k) ? {tone: 'danger' as const} : {})})), {...rest, dir: 'v', barRatio: 1, max, edges: edges.map((e, i) => edgeShown(i, edges.length - 1, every) ? exact(e) : ''), hideZero: true, vlines: lines.sort((a, b) => a.at - b.at), ...(curve ? {curve} : {})}) as never;
}
/** Whether boundary i (of 0..last) is written: every k-th one, and always the last (the one before it gives way when they would be closer than k/2). */
function edgeShown(i: number, last: number, every: number): boolean {
  if (i === last) return true;
  if (i % every !== 0) return false;
  const lastLabelled = last - (last % every);
  return !(lastLabelled !== last && i === lastLabelled && last - lastLabelled < every / 2);
}
/** Every k-th class boundary gets its text, k from the width of the texts and the number of classes (a plot is about 800px wide). */
function labelEvery(texts: string[]): number {
  const widest = Math.max(...texts.map(t => [...t].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? 14 : 8.4), 0)));
  return Math.max(1, Math.ceil((widest + 10) / (780 / (texts.length - 1))));
}
/** The top of a count axis: the next multiple of a round step above the largest value. */
const niceMax = (v: number): number => { const step = niceUp(v / 5); return Math.max(step, Math.ceil(v / step - 1e-9) * step); };
/**
 * A scatter diagram (散布図): the axes fit the data, each stratum (`group`) has its own colour and shape, and `regression: true` draws
 * the least-squares line with the correlation coefficient r.
 *   scatter([{x: 20, y: 3.1}, {x: 25, y: 3.8}, ...], {x: '温度 (℃)', y: '不良率 (%)', regression: true})
 */
export function scatter<const Id extends string = never>(points: readonly ScatterPoint[], opts: ScatterOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function scatter(points: readonly ScatterPoint[], opts: ScatterOpts): PlaneBand {
  if (!opts?.x || !opts?.y) throw new Error("scatter(points, {x, y}) needs the axes' names: {x: '温度', y: '不良率'}");
  return plane(scatterOpts(points, opts)) as PlaneBand;
}
