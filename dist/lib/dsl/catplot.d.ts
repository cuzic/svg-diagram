import type { CatGroup, CatOpts } from '../charts-cat.ts';
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
export {};
