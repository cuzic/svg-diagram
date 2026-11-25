
import type {RegData, RegOpts} from '../charts-reg.ts';
import type {ChartBand} from '../charts.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {withHandle} from './shared.ts';
import {regAlt, resolveReg} from '../charts-reg.ts';
import {chartBandOptions} from '../chart-band-options.ts';

function regBand(who: string, resid: boolean, data: RegData, opts: RegOpts): ChartBand {
  const spec = resolveReg(who, resid, data, opts);
  return {type: 'chart', kind: 'regplot', spec, alt: opts.alt ?? regAlt(spec), ids: [], ...chartBandOptions(who, opts)};
}

const regOne = (who: string, resid: boolean) => <const Id extends string = never>(data: RegData, opts: RegOpts & {id?: Id} = {}): ChartBand & Declares<Id> & HandleOf<Id> => withHandle(regBand(who, resid, data, opts), opts.id) as never;
/** 回帰つき散布図 (seaborn regplot / lmplot): the points, the least-squares line (`order: 2 | 3` for a curve) and its 95% confidence band, one fit per group. `regplot({x: [..], y: [..], group?: [..]}, {stats: true})` */
export const regplot = /* @__PURE__ */ regOne('regplot', false);
/** 残差プロット (seaborn residplot): the residuals around the same fit, with the zero line. */
export const residplot = /* @__PURE__ */ regOne('residplot', true);
