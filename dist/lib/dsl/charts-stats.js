// The seaborn-style statistical charts (categorical, distribution, multivariate): raw values in, the statistics worked out (lib/stats.ts).
import { catBand, clusterBand, distBand, multiBand, regBand } from '../charts-dsl.js';
import { group } from './text-bands.js';
import { row } from './containers.js';
import { chartAxes } from '../charts.js';
import { withAnchors, withHandle } from './shared.js';
export function catplot(data, opts = {}) { return catWrap('catplot', data, opts); }
function catWrap(who, data, opts, kind) {
    const band = catBand(who, data, opts, kind);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
const catOne = (kind, name) => (data, opts = {}) => catWrap(name, data, opts, kind);
/** 箱ひげ図 (seaborn boxplot): quartiles, whiskers at 1.5 IQR, the values beyond them as rings. */
export const boxplot = catOne('box', 'boxplot');
/** バイオリンプロット (seaborn violinplot): a kernel density estimate mirrored around each group, with its quartiles inside. */
export const violinplot = catOne('violin', 'violinplot');
/** ストリッププロット (seaborn stripplot): every value as a point, spread sideways without a pattern (the same data always draws the same). */
export const stripplot = catOne('strip', 'stripplot');
/** スウォームプロット (seaborn swarmplot): every value as a point, laid out so that none touch. */
export const swarmplot = catOne('swarm', 'swarmplot');
/** ポイントプロット (seaborn pointplot): the mean of each group with its error bar, joined by a line per hue. */
export const pointplot = catOne('point', 'pointplot');
/** 棒グラフ・誤差つき (seaborn barplot): the mean of each group as a bar from 0, with its error bar. */
export const barplot = catOne('bar', 'barplot');
function distWrap(who, data, opts, kind) {
    const band = distBand(who, data, opts, kind);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function displot(data, opts = {}) { return distWrap('displot', data, opts, 'hist'); }
const distOne = (kind, name) => (data, opts = {}) => distWrap(name, data, opts, kind);
/** ヒストグラム (seaborn histplot): round class widths shared by the groups; `stat` is a count, a density, a share or a percentage. */
export const histplot = distOne('hist', 'histplot');
/** 密度曲線 (seaborn kdeplot): a Gaussian kernel density estimate with Scott's bandwidth, filled under the curve. */
export const kdeplot = distOne('kde', 'kdeplot');
/** 経験累積分布 (seaborn ecdfplot): the share of values at or below x, as a step line. */
export const ecdfplot = distOne('ecdf', 'ecdfplot');
/** ラグプロット (seaborn rugplot): a tick for every value. */
export const rugplot = distOne('rug', 'rugplot');
const multiOne = (who, mode) => (data, opts = {}) => withHandle(multiBand(who, mode, data, opts), opts.id);
/** 2次元ヒストグラム (seaborn histplot(x=, y=)): the points counted in round-sized cells, the count written in each and shaded. `hist2d({x: [..], y: [..]})` */
export const hist2d = multiOne('hist2d', 'hist2d');
/** ジョイントプロット (seaborn jointplot): a scatter with the histogram of each variable beside it. `jointplot({x: [..], y: [..], group?: [..]})` */
export const jointplot = multiOne('jointplot', 'joint');
/** 2次元密度 (seaborn kdeplot(x=, y=)): a Gaussian density over the plane as five filled bands with their contour lines. `kde2d({x: [..], y: [..]})` */
export const kde2d = multiOne('kde2d', 'kde2d');
/** 散布図行列 (seaborn pairplot): every pair of 2 to 6 variables as a scatter, each variable's histogram on the diagonal. `pairplot({身長: [..], 体重: [..]}, {groups: [..]})` */
export const pairplot = multiOne('pairplot', 'pair');
const regOne = (who, resid) => (data, opts = {}) => withHandle(regBand(who, resid, data, opts), opts.id);
/** 回帰つき散布図 (seaborn regplot / lmplot): the points, the least-squares line (`order: 2 | 3` for a curve) and its 95% confidence band, one fit per group. `regplot({x: [..], y: [..], group?: [..]}, {stats: true})` */
export const regplot = regOne('regplot', false);
/** 残差プロット (seaborn residplot): the residuals around the same fit, with the zero line. */
export const residplot = regOne('residplot', true);
/**
 * クラスタ付きヒートマップ (seaborn clustermap): a table whose rows and columns are put in the order of a hierarchical clustering (average linkage),
 * with the two dendrograms beside it. `scale: 'row' | 'col'` scales each row / column to 0..1 before clustering and shading.
 *   clustermap(['A 店', 'B 店', 'C 店'], ['朝', '昼', '夜'], [[3, 9, 4], [8, 2, 9], [4, 8, 3]], {unit: '件'})
 */
export function clustermap(rows, cols, values, opts = {}) {
    return withHandle(clusterBand(rows, cols, values, opts), opts.id);
}
/**
 * パネル分割 (seaborn FacetGrid / relplot / catplot's col=): one panel per key of `data`, each drawn by `make`, titled with the key, laid out in rows.
 * The panels share their axes (`share`): pass the 4th argument on to the chart.
 *   .add(...facet({東京: a, 大阪: b, 名古屋: c}, (name, values, _i, axes) => histplot(values, {...axes}), {cols: 3}))
 */
export function facet(data, make, opts = {}) {
    const entries = Object.entries(data), cols = opts.cols ?? 2, share = opts.share ?? 'xy';
    if (entries.length === 0)
        throw new Error('facet(data) needs at least one panel');
    if (!Number.isInteger(cols) || cols < 1)
        throw new Error(`facet(): cols must be a whole number >= 1 (got ${opts.cols})`);
    if (!['xy', 'x', 'y', 'none'].includes(share))
        throw new Error(`facet(): share must be xy, x, y or none (got ${String(opts.share)})`);
    let axes = {};
    if (share !== 'none') {
        const seen = entries.map(([key, value], i) => { const b = make(key, value, i, {}); return b.type === 'chart' ? chartAxes(b) : undefined; }).filter((a) => a !== undefined);
        if (seen.length === 0) {
            if (opts.share !== undefined)
                throw new Error('facet(): share needs histplot / kdeplot / ecdfplot / displot / regplot / residplot panels (the others have no axis range to share)');
        }
        else {
            const span = (k) => [Math.min(...seen.map(a => a[k][0])), Math.max(...seen.map(a => a[k][1]))];
            axes = { ...(share.includes('x') ? { xRange: span('x') } : {}), ...(share.includes('y') ? { yRange: span('y') } : {}) };
        }
    }
    const panels = entries.map(([key, value], i) => group(make(key, value, i, axes), { title: key, span: 1, ...(opts.frame === false ? { frame: false } : {}) }));
    const rows = [];
    for (let i = 0; i < panels.length; i += cols)
        rows.push(row(panels.slice(i, i + cols), { cols }));
    return rows;
}
