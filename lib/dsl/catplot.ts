
import type {CatGroup, CatKind, CatOpts} from '../charts-cat.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import {catAlt, resolveCat} from '../charts-cat.ts';
import {chartBandOptions} from '../chart-band-options.ts';

function catBand(who: string, data: readonly CatGroup[] | Readonly<Record<string, readonly number[]>>, opts: CatOpts, kind?: CatKind): ChartBand {
  const spec = resolveCat(who, data, opts, kind);
  return {type: 'chart', kind: 'catplot', spec, alt: opts.alt ?? catAlt(spec), ids: spec.groups.flatMap(g => g.id ? [g.id] : []), ...chartBandOptions(who, opts)};
}

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
export const boxplot = /* @__PURE__ */ catOne('box', 'boxplot') as <const D extends CatData, const Id extends string = never>(data: D, opts?: Omit<CatOpts, 'kind'> & {id?: Id}) => ChartBand & Declares<Id | CatIds<D>> & HandleOf<Id> & AnchorsOf<CatIds<D>>;
/** バイオリンプロット (seaborn violinplot): a kernel density estimate mirrored around each group, with its quartiles inside. */
export const violinplot = /* @__PURE__ */ catOne('violin', 'violinplot') as typeof boxplot;
/** ストリッププロット (seaborn stripplot): every value as a point, spread sideways without a pattern (the same data always draws the same). */
export const stripplot = /* @__PURE__ */ catOne('strip', 'stripplot') as typeof boxplot;
/** スウォームプロット (seaborn swarmplot): every value as a point, laid out so that none touch. */
export const swarmplot = /* @__PURE__ */ catOne('swarm', 'swarmplot') as typeof boxplot;
/** ポイントプロット (seaborn pointplot): the mean of each group with its error bar, joined by a line per hue. */
export const pointplot = /* @__PURE__ */ catOne('point', 'pointplot') as typeof boxplot;
/** 棒グラフ・誤差つき (seaborn barplot): the mean of each group as a bar from 0, with its error bar. */
export const barplot = /* @__PURE__ */ catOne('bar', 'barplot') as typeof boxplot;
