import type { RegData, RegOpts } from '../charts-reg.ts';
import type { ChartBand } from '../charts.ts';
import type { Declares, HandleOf } from '../strict.ts';
/** 回帰つき散布図 (seaborn regplot / lmplot): the points, the least-squares line (`order: 2 | 3` for a curve) and its 95% confidence band, one fit per group. `regplot({x: [..], y: [..], group?: [..]}, {stats: true})` */
export declare const regplot: <const Id extends string = never>(data: RegData, opts?: RegOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
/** 残差プロット (seaborn residplot): the residuals around the same fit, with the zero line. */
export declare const residplot: <const Id extends string = never>(data: RegData, opts?: RegOpts & {
    id?: Id;
}) => ChartBand & Declares<Id> & HandleOf<Id>;
