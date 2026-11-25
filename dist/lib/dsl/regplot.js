import { withHandle } from './shared.js';
import { regAlt, resolveReg } from '../charts-reg.js';
import { chartBandOptions } from '../chart-band-options.js';
function regBand(who, resid, data, opts) {
    const spec = resolveReg(who, resid, data, opts);
    return { type: 'chart', kind: 'regplot', spec, alt: opts.alt ?? regAlt(spec), ids: [], ...chartBandOptions(who, opts) };
}
const regOne = (who, resid) => (data, opts = {}) => withHandle(regBand(who, resid, data, opts), opts.id);
/** 回帰つき散布図 (seaborn regplot / lmplot): the points, the least-squares line (`order: 2 | 3` for a curve) and its 95% confidence band, one fit per group. `regplot({x: [..], y: [..], group?: [..]}, {stats: true})` */
export const regplot = /* @__PURE__ */ regOne('regplot', false);
/** 残差プロット (seaborn residplot): the residuals around the same fit, with the zero line. */
export const residplot = /* @__PURE__ */ regOne('residplot', true);
