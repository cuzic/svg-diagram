import {burndownOpts, burnupOpts, linesOpts, strategyCanvasOpts} from '../charts-lines.ts';
import type {BurndownSpec, BurnupSpec, LineSeries, LinesOpts, StrategyCanvasOpts} from '../charts-lines.ts';
import {heatmapBand, radarBand, sankeyBand, treemapBand, stackedBand, tornadoBand, waterfallBand} from '../charts-dsl.ts';
import type {RadarOpts, RadarSeries} from '../charts-radar.ts';
import type {SankeyLink, SankeyNode, SankeyOpts} from '../charts-sankey.ts';
import type {TreemapNode, TreemapOpts} from '../charts-treemap.ts';
import type {StackColumn, StackedOpts} from '../charts-stacked.ts';
import type {HeatmapOpts} from '../charts-heatmap.ts';
import type {TornadoItem, TornadoOpts} from '../charts-tornado.ts';
import type {ChartBand} from '../charts.ts';
import type {WaterfallOpts, WaterfallStep} from '../charts-waterfall.ts';
import {causalBand, dependencyBand, pertBand} from '../semnet-dsl.ts';
import type {CausalLink, PertTask} from '../semnet-analysis.ts';
import type {CausalNode, CausalOpts, DependencyEdge, DependencyNode, DependencyOpts, PertOpts} from '../semnet.ts';
import type {PlaneBand} from '../types/figures.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {plane} from './figures.ts';
import {withAnchors, withHandle} from './shared.ts';
import type {TreeIds} from './shared.ts';

type ChartIds<S extends readonly {id?: string}[]> = Extract<S[number]['id'], string>;
/**
 * A waterfall chart (ウォーターフォール図): a start value, the changes that lead from it, subtotals / a total. Bars float; an increase
 * rises from the level before it, a decrease hangs from it, connectors carry the level on. Every bar prints its value with its sign.
 *   waterfall([{label: '前期', value: 1000}, {label: '価格', value: 120}, {label: '数量', value: -80}, {label: '今期', kind: 'total'}], {unit: '万円'})
 */
export function waterfall<const S extends readonly WaterfallStep[], const Id extends string = never>(steps: S, opts?: WaterfallOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
export function waterfall(steps: readonly WaterfallStep[], opts: WaterfallOpts = {}): ChartBand {
  const band = waterfallBand(steps, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
/** A PERT / activity-on-node arrow diagram. Timing and zero-slack critical paths are calculated from predecessors. */
export function pert<const T extends readonly PertTask[], const Id extends string = never>(tasks: T, opts?: PertOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<T>> & HandleOf<Id> & AnchorsOf<ChartIds<T>>;
export function pert(tasks: readonly PertTask[], opts: PertOpts = {}): ChartBand { const band = pertBand(tasks, opts); return withHandle(withAnchors(band, band.ids), opts.id); }
/** A causal-loop diagram. Link signs and delays are drawn; simple loops are classified R/B. */
export function causalLoop<const N extends readonly CausalNode[], const Id extends string = never>(nodes: N, links: readonly CausalLink[], opts?: CausalOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<N>> & HandleOf<Id> & AnchorsOf<ChartIds<N>>;
export function causalLoop(nodes: readonly CausalNode[], links: readonly CausalLink[], opts: CausalOpts = {}): ChartBand { const band = causalBand(nodes, links, opts); return withHandle(withAnchors(band, band.ids), opts.id); }
/** A typed / weighted dependency network with an automatic notation legend. */
export function dependencyNetwork<const N extends readonly DependencyNode[], const Id extends string = never>(nodes: N, edges: readonly DependencyEdge[], opts?: DependencyOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<N>> & HandleOf<Id> & AnchorsOf<ChartIds<N>>;
export function dependencyNetwork(nodes: readonly DependencyNode[], edges: readonly DependencyEdge[], opts: DependencyOpts = {}): ChartBand { const band = dependencyBand(nodes, edges, opts); return withHandle(withAnchors(band, band.ids), opts.id); }
/**
 * A radar chart (レーダーチャート): 3-12 axes, 1-4 series. A concentric grid carries the tick values; the series differ by line style
 * and marker shape, and the legend names them. `values: true` prints the value at each vertex.
 *   radar(['品質', '価格', '納期', '対応'], [{label: '自社', values: [4, 3, 5, 4]}, {label: '競合', values: [3, 5, 3, 2]}], {max: 5})
 */
export function radar<const S extends readonly RadarSeries[], const Id extends string = never>(axes: readonly string[], series: S, opts?: RadarOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
export function radar(axes: readonly string[], series: readonly RadarSeries[], opts: RadarOpts = {}): ChartBand {
  const band = radarBand(axes, series, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
/**
 * A multi-series line chart (折れ線グラフ), made on plane(): categories (`x: {categories}`, one value per category, null for a gap) or numbers
 * ([x, y] pairs) along x; each series has a marker shape and a line style of its own and is named at the end of its line; `target` draws
 * a goal line; `annotate` rings and names points. `ideal: true` makes a series the dashed plan line. Kano-model curves: [x, y] pairs with `smooth`.
 *   lines([{label: '自社', values: [3, 4, 5]}, {label: '競合', values: [5, 3, 2]}], {x: {categories: ['価格', '品質', '速さ']}, y: {min: 0, max: 5}})
 */
export function lines<const Id extends string = never>(series: readonly LineSeries[], opts?: LinesOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function lines(series: readonly LineSeries[], opts: LinesOpts = {}): PlaneBand {
  return plane(linesOpts(series, opts)) as PlaneBand;
}
/** A strategy canvas (戦略キャンバス): factors of competition on x, the level offered (low to high) on y, one line per company. */
export function strategyCanvas<const Id extends string = never>(factors: readonly string[], series: readonly {label: string; values: readonly number[]}[], opts?: StrategyCanvasOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function strategyCanvas(factors: readonly string[], series: readonly {label: string; values: readonly number[]}[], opts: StrategyCanvasOpts = {}): PlaneBand {
  return lines(...strategyCanvasOpts(factors, series, opts));
}
/** A burndown chart (バーンダウン): the work left day by day against the ideal line. `actual` runs from day 0; null for days not yet reached. */
export function burndown<const Id extends string = never>(spec: BurndownSpec, opts?: LinesOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function burndown(spec: BurndownSpec, opts: LinesOpts = {}): PlaneBand {
  return lines(...burndownOpts(spec, opts));
}
/** A burnup chart (バーンアップ): the work done climbing towards the scope line, which may move. */
export function burnup<const Id extends string = never>(spec: BurnupSpec, opts?: LinesOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function burnup(spec: BurnupSpec, opts: LinesOpts = {}): PlaneBand {
  return lines(...burnupOpts(spec, opts));
}
/**
 * A Sankey diagram (サンキー図): flows between layers of nodes; the height of a node and the thickness of a ribbon are proportional to
 * the value. Nodes are layered from the sources, labels carry the values, every node id is an anchor for connect() / spotlight.
 *   sankey(['広告', '自然検索', '訪問', '購入', '離脱'], [{from: '広告', to: '訪問', value: 60}, {from: '自然検索', to: '訪問', value: 40}, {from: '訪問', to: '購入', value: 15}, {from: '訪問', to: '離脱', value: 85}], {unit: '千人'})
 */
export function sankey<const N extends readonly (SankeyNode | string)[], const Id extends string = never>(nodes: N, links: readonly SankeyLink[], opts?: SankeyOpts & {id?: Id}): ChartBand & Declares<Id | SankeyIds<N>> & HandleOf<Id> & AnchorsOf<SankeyIds<N>>;
export function sankey(nodes: readonly (SankeyNode | string)[], links: readonly SankeyLink[], opts: SankeyOpts = {}): ChartBand {
  const band = sankeyBand(nodes, links, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
type SankeyIds<N extends readonly (SankeyNode | string)[]> = N[number] extends infer E ? E extends string ? E : E extends {id: infer I extends string} ? I : never : never;
/**
 * A treemap (ツリーマップ): a tree of values as nested rectangles with areas proportional to the values (squarified). Every cell prints its
 * name and value when they fit; one too small is drawn without a label and listed in the description (`strict: true`: an error).
 *   treemap([{label: '国内', children: [{label: '東京', value: 40}, {label: '大阪', value: 22}]}, {label: '海外', value: 30}], {unit: '億円'})
 */
export function treemap<const T extends TreemapNode | readonly TreemapNode[], const Id extends string = never>(tree: T, opts?: TreemapOpts & {id?: Id}): ChartBand & Declares<Id | TreeIds<T extends readonly (infer E)[] ? E : T>> & HandleOf<Id> & AnchorsOf<TreeIds<T extends readonly (infer E)[] ? E : T>>;
export function treemap(tree: TreemapNode | readonly TreemapNode[], opts: TreemapOpts = {}): ChartBand {
  const band = treemapBand(tree, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
/**
 * Stacked columns (積み上げ棒グラフ): each column cut into its parts, a number in every part; `percent: true` makes 100% columns.
 *   stackedBars([{label: '2023', parts: [{label: '国内', value: 60}, {label: '海外', value: 40}]}, ...], {unit: '億円'})
 */
export function stackedBars<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: StackedOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<C>> & HandleOf<Id> & AnchorsOf<ChartIds<C>>;
export function stackedBars(columns: readonly StackColumn[], opts: StackedOpts = {}): ChartBand {
  const band = stackedBand('stackedBars', columns, opts.percent ? 'percent' : 'stacked', opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
/**
 * A mekko chart (マリメッコ図): the width of a column is its total, the height of a part its share of the column — so the area of a
 * part is its share of the whole. Every part prints its share; one too small for the number is left out and stays in the description.
 *   mekko([{label: 'A 社', parts: [{label: '製品', value: 70}, {label: '保守', value: 30}]}, ...], {unit: '億円'})
 */
export function mekko<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: Omit<StackedOpts, 'percent'> & {id?: Id}): ChartBand & Declares<Id | ChartIds<C>> & HandleOf<Id> & AnchorsOf<ChartIds<C>>;
export function mekko(columns: readonly StackColumn[], opts: Omit<StackedOpts, 'percent'> = {}): ChartBand {
  const band = stackedBand('mekko', columns, 'mekko', opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
/**
 * A heatmap (ヒートマップ / コホート表): a table of numbers, each cell shaded by its size in a few steps; the number is always printed.
 * `null` is an empty cell (the unreached part of a cohort triangle).
 *   heatmap(['1月', '2月'], ['0', '1', '2'], [[100, 62, 48], [100, 58, null]], {unit: '%', corner: '登録月 ＼ 経過月'})
 */
export function heatmap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts?: HeatmapOpts & {id?: Id}): ChartBand & Declares<Id> & HandleOf<Id>;
export function heatmap(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts: HeatmapOpts = {}): ChartBand {
  return withHandle(heatmapBand(rows, cols, values, opts), opts.id);
}
/**
 * A tornado chart (トルネード図): the result in the low and the high case of each input, as two bars from the base result, the input
 * the result is most sensitive to first. Values are printed at the ends of the bars.
 *   tornado([{label: '原材料費', low: 850, high: 1150}, {label: '為替', low: 940, high: 1060}], {base: 1000, unit: '百万円'})
 */
export function tornado<const I extends readonly TornadoItem[], const Id extends string = never>(items: I, opts: TornadoOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<I>> & HandleOf<Id> & AnchorsOf<ChartIds<I>>;
export function tornado(items: readonly TornadoItem[], opts: TornadoOpts): ChartBand {
  const band = tornadoBand(items, opts);
  return withHandle(withAnchors(band, band.ids), opts?.id);
}
