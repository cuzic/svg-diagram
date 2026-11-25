
import type {MultiMode, MultiOpts, XY} from '../charts-multi.ts';
import type {ChartBand} from '../charts.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {withHandle} from './shared.ts';
import {multiAlt, resolveMulti} from '../charts-multi.ts';
import {chartBandOptions} from '../chart-band-options.ts';

function multiBand(who: string, mode: MultiMode, data: XY | Readonly<Record<string, readonly number[]>>, opts: MultiOpts): ChartBand {
  const spec = resolveMulti(who, mode, data, opts);
  return {type: 'chart', kind: 'multiplot', spec, alt: opts.alt ?? multiAlt(spec), ids: [], ...chartBandOptions(who, opts)};
}

const multiOne = (who: string, mode: 'hist2d' | 'kde2d' | 'joint' | 'pair') => <const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts: MultiOpts & {id?: Id} = {}): ChartBand & Declares<Id> & HandleOf<Id> => withHandle(multiBand(who, mode, data, opts), opts.id) as never;
/** 2次元ヒストグラム (seaborn histplot(x=, y=)): the points counted in round-sized cells, the count written in each and shaded. `hist2d({x: [..], y: [..]})` */
export const hist2d = /* @__PURE__ */ multiOne('hist2d', 'hist2d');
/** ジョイントプロット (seaborn jointplot): a scatter with the histogram of each variable beside it. `jointplot({x: [..], y: [..], group?: [..]})` */
export const jointplot = /* @__PURE__ */ multiOne('jointplot', 'joint');
/** 2次元密度 (seaborn kdeplot(x=, y=)): a Gaussian density over the plane as five filled bands with their contour lines. `kde2d({x: [..], y: [..]})` */
export const kde2d = /* @__PURE__ */ multiOne('kde2d', 'kde2d');
/** 散布図行列 (seaborn pairplot): every pair of 2 to 6 variables as a scatter, each variable's histogram on the diagonal. `pairplot({身長: [..], 体重: [..]}, {groups: [..]})` */
export const pairplot = /* @__PURE__ */ multiOne('pairplot', 'pair');
