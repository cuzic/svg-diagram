import type { CatGroup, CatOpts } from '../charts-cat.ts';
import type { DistGroup, DistOpts } from '../charts-dist.ts';
import type { MultiOpts, XY } from '../charts-multi.ts';
import type { RegData, RegOpts } from '../charts-reg.ts';
import type { ClusterOpts } from '../charts-cluster.ts';
import type { RowBand } from '../types/containers.ts';
import type { Band } from '../types/index.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
type CatData = readonly CatGroup[] | Readonly<Record<string, readonly number[]>>;
type CatIds<D> = D extends readonly CatGroup[] ? Extract<D[number]['id'], string> : never;
/**
 * seaborn's categorical plots from the raw values: groups of numbers in, quartiles / a density / a confidence interval worked out.
 *   boxplot({東京: [..], 大阪: [..]}, {label: '売上（万円）'})            // 箱ひげ図
 *   catplot([{label: '木', hues: [{name: '昼', values: [..]}, {name: '夜', values: [..]}]}], {kind: ['violin', 'strip']})
 * `kind` is one layer or a list drawn in order (box / violin / strip / swarm / point / bar); `hues` gives each group a second category side by side.
 */
export declare function catplot<const D extends CatData, const Id extends string = never>(data: D, opts?: CatOpts & {
    id?: Id;
}): ChartBand & Declares<Id | CatIds<D>> & HandleOf<Id> & AnchorsOf<CatIds<D>>;
/** 箱ひげ図 (seaborn boxplot): quartiles, whiskers at 1.5 IQR, the values beyond them as rings. */
export declare const boxplot: <const D extends CatData, const Id extends string = never>(data: D, opts?: Omit<CatOpts, 'kind'> & {
    id?: Id;
}) => ChartBand & Declares<Id | CatIds<D>> & HandleOf<Id> & AnchorsOf<CatIds<D>>;
/** バイオリンプロット (seaborn violinplot): a kernel density estimate mirrored around each group, with its quartiles inside. */
export declare const violinplot: typeof boxplot;
/** ストリッププロット (seaborn stripplot): every value as a point, spread sideways without a pattern (the same data always draws the same). */
export declare const stripplot: typeof boxplot;
/** スウォームプロット (seaborn swarmplot): every value as a point, laid out so that none touch. */
export declare const swarmplot: typeof boxplot;
/** ポイントプロット (seaborn pointplot): the mean of each group with its error bar, joined by a line per hue. */
export declare const pointplot: typeof boxplot;
/** 棒グラフ・誤差つき (seaborn barplot): the mean of each group as a bar from 0, with its error bar. */
export declare const barplot: typeof boxplot;
type DistData = readonly number[] | readonly DistGroup[] | Readonly<Record<string, readonly number[]>>;
type DistIds<D> = D extends readonly DistGroup[] ? Extract<D[number]['id'], string> : never;
/**
 * seaborn's distribution plots from the raw values: a list of numbers, or groups ({A: [..], B: [..]}, up to four, told apart by colour and line style).
 *   histplot(values, {label: '待ち時間（分）'})      kdeplot({男: [..], 女: [..]})      ecdfplot(values)
 *   displot(values, {kind: ['hist', 'kde', 'rug']})
 */
export declare function displot<const D extends DistData, const Id extends string = never>(data: D, opts?: DistOpts & {
    id?: Id;
}): ChartBand & Declares<Id | DistIds<D>> & HandleOf<Id> & AnchorsOf<DistIds<D>>;
/** ヒストグラム (seaborn histplot): round class widths shared by the groups; `stat` is a count, a density, a share or a percentage. */
export declare const histplot: <const D extends DistData, const Id extends string = never>(data: D, opts?: Omit<DistOpts, 'kind'> & {
    id?: Id;
}) => ChartBand & Declares<Id | DistIds<D>> & HandleOf<Id> & AnchorsOf<DistIds<D>>;
/** 密度曲線 (seaborn kdeplot): a Gaussian kernel density estimate with Scott's bandwidth, filled under the curve. */
export declare const kdeplot: typeof histplot;
/** 経験累積分布 (seaborn ecdfplot): the share of values at or below x, as a step line. */
export declare const ecdfplot: typeof histplot;
/** ラグプロット (seaborn rugplot): a tick for every value. */
export declare const rugplot: typeof histplot;
/** 2次元ヒストグラム (seaborn histplot(x=, y=)): the points counted in round-sized cells, the count written in each and shaded. `hist2d({x: [..], y: [..]})` */
export declare const hist2d: <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/** ジョイントプロット (seaborn jointplot): a scatter with the histogram of each variable beside it. `jointplot({x: [..], y: [..], group?: [..]})` */
export declare const jointplot: <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/** 2次元密度 (seaborn kdeplot(x=, y=)): a Gaussian density over the plane as five filled bands with their contour lines. `kde2d({x: [..], y: [..]})` */
export declare const kde2d: <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/** 散布図行列 (seaborn pairplot): every pair of 2 to 6 variables as a scatter, each variable's histogram on the diagonal. `pairplot({身長: [..], 体重: [..]}, {groups: [..]})` */
export declare const pairplot: <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/** 回帰つき散布図 (seaborn regplot / lmplot): the points, the least-squares line (`order: 2 | 3` for a curve) and its 95% confidence band, one fit per group. `regplot({x: [..], y: [..], group?: [..]}, {stats: true})` */
export declare const regplot: <const Id extends string = never>(data: RegData, opts?: RegOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/** 残差プロット (seaborn residplot): the residuals around the same fit, with the zero line. */
export declare const residplot: <const Id extends string = never>(data: RegData, opts?: RegOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/**
 * クラスタ付きヒートマップ (seaborn clustermap): a table whose rows and columns are put in the order of a hierarchical clustering (average linkage),
 * with the two dendrograms beside it. `scale: 'row' | 'col'` scales each row / column to 0..1 before clustering and shading.
 *   clustermap(['A 店', 'B 店', 'C 店'], ['朝', '昼', '夜'], [[3, 9, 4], [8, 2, 9], [4, 8, 3]], {unit: '件'})
 */
export declare function clustermap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly number[])[], opts?: ClusterOpts & {
    id?: Id;
}): ChartBand & Declares<Id> & HandleOf<Id>;
export interface FacetOpts {
    /** Panels per row (default 2). The last row keeps the same column width. */
    cols?: number;
    /** Draw a frame (with the panel's name as its title) around each panel (default true; false: only the name above). */
    frame?: boolean;
    /**
     * Which axes the panels share (as seaborn's sharex / sharey): 'xy' (default), 'x', 'y' or 'none'. The panels are drawn once to see their axes,
     * then again with the combined range handed to `make` as its 4th argument (`{xRange, yRange}`: spread it into the chart's options). Only
     * histplot / kdeplot / ecdfplot / displot / regplot / residplot panels have axes to share; by default other panels are left alone,
     * and an explicit 'x' / 'y' / 'xy' with no such panel is an error.
     */
    share?: 'xy' | 'x' | 'y' | 'none';
}
/** The axes a facet() hands to `make` so that the panels agree. */
export interface FacetAxes {
    xRange?: [number, number];
    yRange?: [number, number];
}
/**
 * パネル分割 (seaborn FacetGrid / relplot / catplot's col=): one panel per key of `data`, each drawn by `make`, titled with the key, laid out in rows.
 * The panels share their axes (`share`): pass the 4th argument on to the chart.
 *   .add(...facet({東京: a, 大阪: b, 名古屋: c}, (name, values, _i, axes) => histplot(values, {...axes}), {cols: 3}))
 */
export declare function facet<T>(data: Readonly<Record<string, T>>, make: (key: string, value: T, index: number, axes: FacetAxes) => Band, opts?: FacetOpts): RowBand[];
export type { CatGroup, CatKind, CatOpts } from '../charts-cat.ts';
export type { DistGroup, DistKind, DistOpts, DistStat } from '../charts-dist.ts';
export type { MultiOpts, XY } from '../charts-multi.ts';
export type { RegData, RegOpts } from '../charts-reg.ts';
export type { ClusterOpts } from '../charts-cluster.ts';
