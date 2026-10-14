// The seaborn-style statistical charts (categorical, distribution, multivariate): raw values in, the statistics worked out (lib/stats.ts).
import {catBand, distBand, multiBand} from '../charts-dsl.ts';
import type {CatGroup, CatKind, CatOpts} from '../charts-cat.ts';
import type {DistGroup, DistKind, DistOpts} from '../charts-dist.ts';
import type {MultiOpts, XY} from '../charts-multi.ts';
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

const multiOne = (who: string, mode: 'hist2d' | 'joint' | 'pair') => <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts: MultiOpts & {id?: Id} = {}): ChartBand & Declares<Id> & HandleOf<Id> => withHandle(multiBand(who, mode, data, opts), opts.id) as never;
/** 2次元ヒストグラム (seaborn histplot(x=, y=)): the points counted in round-sized cells, the count written in each and shaded. `hist2d({x: [..], y: [..]})` */
export const hist2d = multiOne('hist2d', 'hist2d');
/** ジョイントプロット (seaborn jointplot): a scatter with the histogram of each variable beside it. `jointplot({x: [..], y: [..], group?: [..]})` */
export const jointplot = multiOne('jointplot', 'joint');
/** 散布図行列 (seaborn pairplot): every pair of 2 to 6 variables as a scatter, each variable's histogram on the diagonal. `pairplot({身長: [..], 体重: [..]}, {groups: [..]})` */
export const pairplot = multiOne('pairplot', 'pair');

export type {CatGroup, CatKind, CatOpts} from '../charts-cat.ts';
export type {DistGroup, DistKind, DistOpts, DistStat} from '../charts-dist.ts';
export type {MultiOpts, XY} from '../charts-multi.ts';
