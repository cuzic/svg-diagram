import { withAnchors, withHandle } from './shared.js';
import { catAlt, resolveCat } from '../charts-cat.js';
import { chartBandOptions } from '../chart-band-options.js';
function catBand(who, data, opts, kind) {
    const spec = resolveCat(who, data, opts, kind);
    return { type: 'chart', kind: 'catplot', spec, alt: opts.alt ?? catAlt(spec), ids: spec.groups.flatMap(g => g.id ? [g.id] : []), ...chartBandOptions(who, opts) };
}
export function catplot(data, opts = {}) { return catWrap('catplot', data, opts); }
function catWrap(who, data, opts, kind) {
    const band = catBand(who, data, opts, kind);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
const catOne = (kind, name) => (data, opts = {}) => catWrap(name, data, opts, kind);
/** 箱ひげ図 (seaborn boxplot): quartiles, whiskers at 1.5 IQR, the values beyond them as rings. */
export const boxplot = /* @__PURE__ */ catOne('box', 'boxplot');
/** バイオリンプロット (seaborn violinplot): a kernel density estimate mirrored around each group, with its quartiles inside. */
export const violinplot = /* @__PURE__ */ catOne('violin', 'violinplot');
/** ストリッププロット (seaborn stripplot): every value as a point, spread sideways without a pattern (the same data always draws the same). */
export const stripplot = /* @__PURE__ */ catOne('strip', 'stripplot');
/** スウォームプロット (seaborn swarmplot): every value as a point, laid out so that none touch. */
export const swarmplot = /* @__PURE__ */ catOne('swarm', 'swarmplot');
/** ポイントプロット (seaborn pointplot): the mean of each group with its error bar, joined by a line per hue. */
export const pointplot = /* @__PURE__ */ catOne('point', 'pointplot');
/** 棒グラフ・誤差つき (seaborn barplot): the mean of each group as a bar from 0, with its error bar. */
export const barplot = /* @__PURE__ */ catOne('bar', 'barplot');
