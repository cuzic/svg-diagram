import { withAnchors, withHandle } from './shared.js';
import { distAlt, resolveDist } from '../charts-dist.js';
import { chartBandOptions } from '../chart-band-options.js';
function distBand(who, data, opts, kind) {
    const spec = resolveDist(who, data, opts, kind);
    return { type: 'chart', kind: 'distplot', spec, alt: opts.alt ?? distAlt(spec), ids: spec.groups.flatMap(g => g.id ? [g.id] : []), ...chartBandOptions(who, opts) };
}
function distWrap(who, data, opts, kind) {
    const band = distBand(who, data, opts, kind);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function displot(data, opts = {}) { return distWrap('displot', data, opts, 'hist'); }
const distOne = (kind, name) => (data, opts = {}) => distWrap(name, data, opts, kind);
/** ヒストグラム (seaborn histplot): round class widths shared by the groups; `stat` is a count, a density, a share or a percentage. */
export const histplot = /* @__PURE__ */ distOne('hist', 'histplot');
/** 密度曲線 (seaborn kdeplot): a Gaussian kernel density estimate with Scott's bandwidth, filled under the curve. */
export const kdeplot = /* @__PURE__ */ distOne('kde', 'kdeplot');
/** 経験累積分布 (seaborn ecdfplot): the share of values at or below x, as a step line. */
export const ecdfplot = /* @__PURE__ */ distOne('ecdf', 'ecdfplot');
/** ラグプロット (seaborn rugplot): a tick for every value. */
export const rugplot = /* @__PURE__ */ distOne('rug', 'rugplot');
