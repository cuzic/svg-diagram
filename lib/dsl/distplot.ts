
import type {DistGroup, DistKind, DistOpts} from '../charts-dist.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import {distAlt, resolveDist} from '../charts-dist.ts';
import {chartBandOptions} from '../chart-band-options.ts';

function distBand(who: string, data: readonly number[] | readonly DistGroup[] | Readonly<Record<string, readonly number[]>>, opts: DistOpts, kind: DistKind): ChartBand {
  const spec = resolveDist(who, data, opts, kind);
  return {type: 'chart', kind: 'distplot', spec, alt: opts.alt ?? distAlt(spec), ids: spec.groups.flatMap(g => g.id ? [g.id] : []), ...chartBandOptions(who, opts)};
}

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
export const histplot = /* @__PURE__ */ distOne('hist', 'histplot') as <const D extends DistData, const Id extends string = never>(data: D, opts?: Omit<DistOpts, 'kind'> & {id?: Id}) => ChartBand & Declares<Id | DistIds<D>> & HandleOf<Id> & AnchorsOf<DistIds<D>>;
/** 密度曲線 (seaborn kdeplot): a Gaussian kernel density estimate with Scott's bandwidth, filled under the curve. */
export const kdeplot = /* @__PURE__ */ distOne('kde', 'kdeplot') as typeof histplot;
/** 経験累積分布 (seaborn ecdfplot): the share of values at or below x, as a step line. */
export const ecdfplot = /* @__PURE__ */ distOne('ecdf', 'ecdfplot') as typeof histplot;
/** ラグプロット (seaborn rugplot): a tick for every value. */
export const rugplot = /* @__PURE__ */ distOne('rug', 'rugplot') as typeof histplot;
