import type { DistGroup, DistOpts } from '../charts-dist.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
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
export {};
