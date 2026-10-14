// The seaborn-style statistical charts (categorical, distribution, multivariate): raw values in, the statistics worked out (lib/stats.ts).
import {catBand, clusterBand, distBand, multiBand, regBand} from '../charts-dsl.ts';
import type {CatGroup, CatKind, CatOpts} from '../charts-cat.ts';
import type {DistGroup, DistKind, DistOpts} from '../charts-dist.ts';
import type {MultiOpts, XY} from '../charts-multi.ts';
import type {RegData, RegOpts} from '../charts-reg.ts';
import type {ClusterOpts} from '../charts-cluster.ts';
import type {Band, RowBand} from '../types.ts';
import {group} from './text-bands.ts';
import {row} from './containers.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';

type CatData = readonly CatGroup[] | Readonly<Record<string, readonly number[]>>;
type CatIds<D> = D extends readonly CatGroup[] ? Extract<D[number]['id'], string> : never;
/**
 * seaborn's categorical plots from the raw values: groups of numbers in, quartiles / a density / a confidence interval worked out.
 *   boxplot({東京: [..], 大阪: [..]}, {label: '売上（万円）'})            // 箱ひげ図
 *   catplot([{label: '木', hues: [{name: '昼', values: [..]}, {name: '夜', values: [..]}]}], {kind: ['violin', 'strip']})
 * `kind` is one layer or a list drawn in order (box / violin / strip / swarm / point / bar); `hues` gives each group a second category side by side.
 */
export function catplot<const D extends CatData, const Id extends string = never>(data: D, opts?: CatOpts & {id?: Id}): ChartBand & Declares<Id | CatIds<D>> & HandleOf<Id> & AnchorsOf<CatIds<D>>;
export function catplot(data: CatData, opts: CatOpts = {}): ChartBand { return catWrap('catplot', data, opts); }
function catWrap(who: string, data: CatData, opts: CatOpts, kind?: CatKind): ChartBand {
  const band = catBand(who, data, opts, kind);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
const catOne = (kind: CatKind, name: string) => (data: CatData, opts: CatOpts = {}): ChartBand => catWrap(name, data, opts, kind);
/** 箱ひげ図 (seaborn boxplot): quartiles, whiskers at 1.5 IQR, the values beyond them as rings. */
export const boxplot = catOne('box', 'boxplot') as <const D extends CatData, const Id extends string = never>(data: D, opts?: Omit<CatOpts, 'kind'> & {id?: Id}) => ChartBand & Declares<Id | CatIds<D>> & HandleOf<Id> & AnchorsOf<CatIds<D>>;
/** バイオリンプロット (seaborn violinplot): a kernel density estimate mirrored around each group, with its quartiles inside. */
export const violinplot = catOne('violin', 'violinplot') as typeof boxplot;
/** ストリッププロット (seaborn stripplot): every value as a point, spread sideways without a pattern (the same data always draws the same). */
export const stripplot = catOne('strip', 'stripplot') as typeof boxplot;
/** スウォームプロット (seaborn swarmplot): every value as a point, laid out so that none touch. */
export const swarmplot = catOne('swarm', 'swarmplot') as typeof boxplot;
/** ポイントプロット (seaborn pointplot): the mean of each group with its error bar, joined by a line per hue. */
export const pointplot = catOne('point', 'pointplot') as typeof boxplot;
/** 棒グラフ・誤差つき (seaborn barplot): the mean of each group as a bar from 0, with its error bar. */
export const barplot = catOne('bar', 'barplot') as typeof boxplot;

type DistData = readonly number[] | readonly DistGroup[] | Readonly<Record<string, readonly number[]>>;
type DistIds<D> = D extends readonly DistGroup[] ? Extract<D[number]['id'], string> : never;
function distWrap(who: string, data: DistData, opts: DistOpts, kind: DistKind): ChartBand {
  const band = distBand(who, data, opts, kind);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
/**
 * seaborn's distribution plots from the raw values: a list of numbers, or groups ({A: [..], B: [..]}, up to four, told apart by colour and line style).
 *   histplot(values, {label: '待ち時間（分）'})      kdeplot({男: [..], 女: [..]})      ecdfplot(values)
 *   displot(values, {kind: ['hist', 'kde', 'rug']})
 */
export function displot<const D extends DistData, const Id extends string = never>(data: D, opts?: DistOpts & {id?: Id}): ChartBand & Declares<Id | DistIds<D>> & HandleOf<Id> & AnchorsOf<DistIds<D>>;
export function displot(data: DistData, opts: DistOpts = {}): ChartBand { return distWrap('displot', data, opts, 'hist'); }
const distOne = (kind: DistKind, name: string) => (data: DistData, opts: DistOpts = {}): ChartBand => distWrap(name, data, opts, kind);
/** ヒストグラム (seaborn histplot): round class widths shared by the groups; `stat` is a count, a density, a share or a percentage. */
export const histplot = distOne('hist', 'histplot') as <const D extends DistData, const Id extends string = never>(data: D, opts?: Omit<DistOpts, 'kind'> & {id?: Id}) => ChartBand & Declares<Id | DistIds<D>> & HandleOf<Id> & AnchorsOf<DistIds<D>>;
/** 密度曲線 (seaborn kdeplot): a Gaussian kernel density estimate with Scott's bandwidth, filled under the curve. */
export const kdeplot = distOne('kde', 'kdeplot') as typeof histplot;
/** 経験累積分布 (seaborn ecdfplot): the share of values at or below x, as a step line. */
export const ecdfplot = distOne('ecdf', 'ecdfplot') as typeof histplot;
/** ラグプロット (seaborn rugplot): a tick for every value. */
export const rugplot = distOne('rug', 'rugplot') as typeof histplot;

const multiOne = (who: string, mode: 'hist2d' | 'kde2d' | 'joint' | 'pair') => <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts: MultiOpts & {id?: Id} = {}): ChartBand & Declares<Id> & HandleOf<Id> => withHandle(multiBand(who, mode, data, opts), opts.id) as never;
/** 2次元ヒストグラム (seaborn histplot(x=, y=)): the points counted in round-sized cells, the count written in each and shaded. `hist2d({x: [..], y: [..]})` */
export const hist2d = multiOne('hist2d', 'hist2d');
/** ジョイントプロット (seaborn jointplot): a scatter with the histogram of each variable beside it. `jointplot({x: [..], y: [..], group?: [..]})` */
export const jointplot = multiOne('jointplot', 'joint');
/** 2次元密度 (seaborn kdeplot(x=, y=)): a Gaussian density over the plane as five filled bands with their contour lines. `kde2d({x: [..], y: [..]})` */
export const kde2d = multiOne('kde2d', 'kde2d');
/** 散布図行列 (seaborn pairplot): every pair of 2 to 6 variables as a scatter, each variable's histogram on the diagonal. `pairplot({身長: [..], 体重: [..]}, {groups: [..]})` */
export const pairplot = multiOne('pairplot', 'pair');

const regOne = (who: string, resid: boolean) => <const Id extends string = never>(data: RegData, opts: RegOpts & {id?: Id} = {}): ChartBand & Declares<Id> & HandleOf<Id> => withHandle(regBand(who, resid, data, opts), opts.id) as never;
/** 回帰つき散布図 (seaborn regplot / lmplot): the points, the least-squares line (`order: 2 | 3` for a curve) and its 95% confidence band, one fit per group. `regplot({x: [..], y: [..], group?: [..]}, {stats: true})` */
export const regplot = regOne('regplot', false);
/** 残差プロット (seaborn residplot): the residuals around the same fit, with the zero line. */
export const residplot = regOne('residplot', true);

/**
 * クラスタ付きヒートマップ (seaborn clustermap): a table whose rows and columns are put in the order of a hierarchical clustering (average linkage),
 * with the two dendrograms beside it. `scale: 'row' | 'col'` scales each row / column to 0..1 before clustering and shading.
 *   clustermap(['A 店', 'B 店', 'C 店'], ['朝', '昼', '夜'], [[3, 9, 4], [8, 2, 9], [4, 8, 3]], {unit: '件'})
 */
export function clustermap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly number[])[], opts: ClusterOpts & {id?: Id} = {}): ChartBand & Declares<Id> & HandleOf<Id> {
  return withHandle(clusterBand(rows, cols, values, opts), opts.id) as never;
}
export interface FacetOpts {
  /** Panels per row (default 2). The last row keeps the same column width. */
  cols?: number;
  /** Draw a frame (with the panel's name as its title) around each panel (default true; false: only the name above). */
  frame?: boolean;
}
/**
 * パネル分割 (seaborn FacetGrid / relplot / catplot's col=): one panel per key of `data`, each drawn by `make`, titled with the key, laid out in rows.
 * Each panel scales itself, widening only to its own data: give the charts the same `xRange` / `yRange` (histplot / displot / regplot) to share the axes.
 *   .add(...facet({東京: a, 大阪: b, 名古屋: c}, (name, values) => histplot(values, {xRange: [40, 100], yRange: [0, 8]}), {cols: 3}))
 */
export function facet<T>(data: Readonly<Record<string, T>>, make: (key: string, value: T, index: number) => Band, opts: FacetOpts = {}): RowBand[] {
  const entries = Object.entries(data), cols = opts.cols ?? 2;
  if (entries.length === 0) throw new Error('facet(data) needs at least one panel');
  if (!Number.isInteger(cols) || cols < 1) throw new Error(`facet(): cols must be a whole number >= 1 (got ${opts.cols})`);
  const panels = entries.map(([key, value], i) => group(make(key, value, i) as never, {title: key, span: 1, ...(opts.frame === false ? {frame: false} : {})}));
  const rows: RowBand[] = [];
  for (let i = 0; i < panels.length; i += cols) rows.push(row(panels.slice(i, i + cols) as never, {cols}) as never);
  return rows;
}

export type {CatGroup, CatKind, CatOpts} from '../charts-cat.ts';
export type {DistGroup, DistKind, DistOpts, DistStat} from '../charts-dist.ts';
export type {MultiOpts, XY} from '../charts-multi.ts';
export type {RegData, RegOpts} from '../charts-reg.ts';
export type {ClusterOpts} from '../charts-cluster.ts';
