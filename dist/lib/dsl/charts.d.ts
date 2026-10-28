import type { BurndownSpec, BurnupSpec, LineSeries, LinesOpts, StrategyCanvasOpts } from '../charts-lines.ts';
import type { RadarOpts, RadarSeries } from '../charts-radar.ts';
import type { SankeyLink, SankeyNode, SankeyOpts } from '../charts-sankey.ts';
import type { TreemapNode, TreemapOpts } from '../charts-treemap.ts';
import type { StackColumn, StackedOpts } from '../charts-stacked.ts';
import type { HeatmapOpts } from '../charts-heatmap.ts';
import type { TornadoItem, TornadoOpts } from '../charts-tornado.ts';
import type { BubbleOpts, BubblePoint } from '../charts-bubble.ts';
import type { ButterflyOpts, ButterflyRow } from '../charts-butterfly.ts';
import type { ComboOpts, ComboSeries } from '../charts-combo.ts';
import type { HarveyOpts, HarveyRow } from '../charts-harvey.ts';
import type { ChartBand } from '../charts.ts';
import type { WaterfallOpts, WaterfallStep } from '../charts-waterfall.ts';
import type { CausalLink, PertTask } from '../semnet-analysis.ts';
import type { CausalIntervention, CausalNode, CausalOpts, DependencyEdge, DependencyNode, DependencyOpts, PertOpts } from '../semnet.ts';
import type { PlaneBand } from '../types/figures.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { TreeIds } from './shared.ts';
type ChartIds<S extends readonly {
    id?: string;
}[]> = Extract<S[number]['id'], string>;
/**
 * A waterfall chart (ウォーターフォール図): a start value, the changes that lead from it, subtotals / a total. Bars float; an increase
 * rises from the level before it, a decrease hangs from it, connectors carry the level on. Every bar prints its value with its sign.
 *   waterfall([{label: '前期', value: 1000}, {label: '価格', value: 120}, {label: '数量', value: -80}, {label: '今期', kind: 'total'}], {unit: '万円'})
 */
export declare function waterfall<const S extends readonly WaterfallStep[], const Id extends string = never>(steps: S, opts?: WaterfallOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
/** A PERT / activity-on-node arrow diagram. Timing and zero-slack critical paths are calculated from predecessors. */
export declare function pert<const T extends readonly PertTask[], const Id extends string = never>(tasks: T, opts?: PertOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<T>> & HandleOf<Id> & AnchorsOf<ChartIds<T>>;
/** A causal-loop diagram. Link signs and delays are drawn; simple loops are classified R/B. */
export declare function causalLoop<const N extends readonly CausalNode[], const I extends readonly CausalIntervention[] = readonly [], const Id extends string = never>(nodes: N, links: readonly CausalLink[], opts?: Omit<CausalOpts, 'interventions'> & {
    id?: Id;
    interventions?: I;
}): ChartBand & Declares<Id | ChartIds<N> | ChartIds<I>> & HandleOf<Id> & AnchorsOf<ChartIds<N> | ChartIds<I>>;
/** A typed / weighted dependency network with an automatic notation legend. */
export declare function dependencyNetwork<const N extends readonly DependencyNode[], const Id extends string = never>(nodes: N, edges: readonly DependencyEdge[], opts?: DependencyOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<N>> & HandleOf<Id> & AnchorsOf<ChartIds<N>>;
/**
 * A radar chart (レーダーチャート): 3-12 axes, 1-4 series. A concentric grid carries the tick values; the series differ by line style
 * and marker shape, and the legend names them. `values: true` prints the value at each vertex.
 *   radar(['品質', '価格', '納期', '対応'], [{label: '自社', values: [4, 3, 5, 4]}, {label: '競合', values: [3, 5, 3, 2]}], {max: 5})
 */
export declare function radar<const S extends readonly RadarSeries[], const Id extends string = never>(axes: readonly string[], series: S, opts?: RadarOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
/**
 * A multi-series line chart (折れ線グラフ), made on plane(): categories (`x: {categories}`, one value per category, null for a gap) or numbers
 * ([x, y] pairs) along x; each series has a marker shape and a line style of its own and is named at the end of its line; `target` draws
 * a goal line; `annotate` rings and names points. `ideal: true` makes a series the dashed plan line. Kano-model curves: [x, y] pairs with `smooth`.
 *   lines([{label: '自社', values: [3, 4, 5]}, {label: '競合', values: [5, 3, 2]}], {x: {categories: ['価格', '品質', '速さ']}, y: {min: 0, max: 5}})
 */
export declare function lines<const Id extends string = never>(series: readonly LineSeries[], opts?: LinesOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
/** A strategy canvas (戦略キャンバス): factors of competition on x, the level offered (low to high) on y, one line per company. */
export declare function strategyCanvas<const Id extends string = never>(factors: readonly string[], series: readonly {
    label: string;
    values: readonly number[];
}[], opts?: StrategyCanvasOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
/** A burndown chart (バーンダウン): the work left day by day against the ideal line. `actual` runs from day 0; null for days not yet reached. */
export declare function burndown<const Id extends string = never>(spec: BurndownSpec, opts?: LinesOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
/** A burnup chart (バーンアップ): the work done climbing towards the scope line, which may move. */
export declare function burnup<const Id extends string = never>(spec: BurnupSpec, opts?: LinesOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
/**
 * A Sankey diagram (サンキー図): flows between layers of nodes; the height of a node and the thickness of a ribbon are proportional to
 * the value. Nodes are layered from the sources, labels carry the values, every node id is an anchor for connect() / spotlight.
 *   sankey(['広告', '自然検索', '訪問', '購入', '離脱'], [{from: '広告', to: '訪問', value: 60}, {from: '自然検索', to: '訪問', value: 40}, {from: '訪問', to: '購入', value: 15}, {from: '訪問', to: '離脱', value: 85}], {unit: '千人'})
 */
export declare function sankey<const N extends readonly (SankeyNode | string)[], const Id extends string = never>(nodes: N, links: readonly SankeyLink[], opts?: SankeyOpts & {
    id?: Id;
}): ChartBand & Declares<Id | SankeyIds<N>> & HandleOf<Id> & AnchorsOf<SankeyIds<N>>;
type SankeyIds<N extends readonly (SankeyNode | string)[]> = N[number] extends infer E ? E extends string ? E : E extends {
    id: infer I extends string;
} ? I : never : never;
/**
 * A treemap (ツリーマップ): a tree of values as nested rectangles with areas proportional to the values (squarified). Every cell prints its
 * name and value when they fit; one too small is drawn without a label and listed in the description (`strict: true`: an error).
 *   treemap([{label: '国内', children: [{label: '東京', value: 40}, {label: '大阪', value: 22}]}, {label: '海外', value: 30}], {unit: '億円'})
 */
export declare function treemap<const T extends TreemapNode | readonly TreemapNode[], const Id extends string = never>(tree: T, opts?: TreemapOpts & {
    id?: Id;
}): ChartBand & Declares<Id | TreeIds<T extends readonly (infer E)[] ? E : T>> & HandleOf<Id> & AnchorsOf<TreeIds<T extends readonly (infer E)[] ? E : T>>;
/**
 * Stacked columns (積み上げ棒グラフ): each column cut into its parts, a number in every part; `percent: true` makes 100% columns.
 *   stackedBars([{label: '2023', parts: [{label: '国内', value: 60}, {label: '海外', value: 40}]}, ...], {unit: '億円'})
 */
export declare function stackedBars<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: StackedOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<C>> & HandleOf<Id> & AnchorsOf<ChartIds<C>>;
/**
 * A mekko chart (マリメッコ図): the width of a column is its total, the height of a part its share of the column — so the area of a
 * part is its share of the whole. Every part prints its share; one too small for the number is left out and stays in the description.
 *   mekko([{label: 'A 社', parts: [{label: '製品', value: 70}, {label: '保守', value: 30}]}, ...], {unit: '億円'})
 */
export declare function mekko<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: Omit<StackedOpts, 'percent'> & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<C>> & HandleOf<Id> & AnchorsOf<ChartIds<C>>;
/**
 * A heatmap (ヒートマップ / コホート表): a table of numbers, each cell shaded by its size in a few steps; the number is always printed.
 * `null` is an empty cell (the unreached part of a cohort triangle).
 *   heatmap(['1月', '2月'], ['0', '1', '2'], [[100, 62, 48], [100, 58, null]], {unit: '%', corner: '登録月 ＼ 経過月'})
 */
export declare function heatmap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts?: HeatmapOpts & {
    id?: Id;
}): ChartBand & Declares<Id> & HandleOf<Id>;
/**
 * A tornado chart (トルネード図): the result in the low and the high case of each input, as two bars from the base result, the input
 * the result is most sensitive to first. Values are printed at the ends of the bars.
 *   tornado([{label: '原材料費', low: 850, high: 1150}, {label: '為替', low: 940, high: 1060}], {base: 1000, unit: '百万円'})
 */
export declare function tornado<const I extends readonly TornadoItem[], const Id extends string = never>(items: I, opts: TornadoOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<I>> & HandleOf<Id> & AnchorsOf<ChartIds<I>>;
/**
 * A bubble chart (バブルチャート): x and y on numeric axes, the AREA of the circle for a third measure (growth × share × revenue).
 * Every bubble is named; `x.line` / `y.line` draw a dashed threshold; a legend circle says what the area stands for.
 *   bubble([{label: 'A 事業', x: 1.8, y: 12, size: 520}, {label: 'B 事業', x: 0.6, y: 4, size: 180}], {x: {title: '相対シェア'}, y: {title: '市場成長率', unit: '%'}, sizeTitle: '売上', sizeUnit: '億円'})
 */
export declare function bubble<const P extends readonly BubblePoint[], const Id extends string = never>(points: P, opts?: BubbleOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<P>> & HandleOf<Id> & AnchorsOf<ChartIds<P>>;
/**
 * A butterfly chart (バタフライチャート): two groups' bars grow left and right from a column of item names, on one scale.
 *   butterfly([{label: '品質', left: 82, right: 74}, {label: '価格', left: 60, right: 88}], {leftLabel: '自社', rightLabel: '競合', unit: '点'})
 */
export declare function butterfly<const R extends readonly ButterflyRow[], const Id extends string = never>(rows: R, opts: ButterflyOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<R>> & HandleOf<Id> & AnchorsOf<ChartIds<R>>;
/**
 * A combo chart (コンボチャート / 複合グラフ): bars (left axis) and lines (right axis by default) over the same categories; `stack: true` piles the bars.
 *   combo(['2022', '2023', '2024'], [{label: '売上', type: 'bar', values: [120, 150, 190]}, {label: '営業利益率', type: 'line', values: [8, 9.5, 12]}], {y: {unit: '億円'}, y2: {unit: '%'}})
 */
export declare function combo<const S extends readonly ComboSeries[], const Id extends string = never>(categories: readonly string[], series: S, opts?: ComboOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
type HarveyIds<R extends readonly HarveyRow[]> = R[number] extends infer E ? E extends {
    id: infer I extends string;
} ? I : never : never;
/**
 * A table of Harvey balls (ハーベイボール): each cell is a circle filled 0–4 quarters (null: not rated), rows are criteria, columns are options.
 *   harvey(['価格', '品質'], ['A 社', 'B 社'], [[4, 2], [1, 3]], {highlight: ['A 社']})
 */
export declare function harvey<const R extends readonly HarveyRow[], const Id extends string = never>(rows: R, cols: readonly string[], values: readonly (readonly (number | null)[])[], opts?: HarveyOpts & {
    id?: Id;
}): ChartBand & Declares<Id | HarveyIds<R>> & HandleOf<Id> & AnchorsOf<HarveyIds<R>>;
export {};
