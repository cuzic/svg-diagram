// The band constructors behind waterfall(), radar(), heatmap(), ...: validate the data, work out the description, build the band.
// dsl.ts wraps each in a typed function that adds the handle (`.right`, `.at()`) and the typed anchor ids.
import { assertScope } from './scope-name.js';
import { resolveWaterfall, waterfallAlt } from './charts-waterfall.js';
import { resolveTornado, tornadoAlt } from './charts-tornado.js';
import { heatmapAlt, resolveHeatmap } from './charts-heatmap.js';
import { resolveStacked, stackedAlt } from './charts-stacked.js';
import { radarAlt, resolveRadar } from './charts-radar.js';
import { resolveTreemap, treemapAlt } from './charts-treemap.js';
import { resolveSankey, sankeyAlt } from './charts-sankey.js';
import { catAlt, resolveCat } from './charts-cat.js';
import { distAlt, resolveDist } from './charts-dist.js';
import { multiAlt, resolveMulti } from './charts-multi.js';
import { regAlt, resolveReg } from './charts-reg.js';
import { clusterAlt, resolveCluster } from './charts-cluster.js';
import { bubbleAlt, resolveBubble } from './charts-bubble.js';
import { butterflyAlt, resolveButterfly } from './charts-butterfly.js';
import { comboAlt, resolveCombo } from './charts-combo.js';
import { harveyAlt, resolveHarvey } from './charts-harvey.js';
import { fail } from './charts-base.js';
import { resolveIcon } from './icon-registry.js';
function common(who, opts) {
    assertScope(opts.scope, `${who}()`);
    if (opts.labelRole !== undefined && !['note', 'banner', 'stat'].includes(opts.labelRole))
        fail(who, `labelRole must be note, banner or stat (got ${String(opts.labelRole)})`);
    for (const k of ['width', 'height'])
        if (opts[k] !== undefined && !(Number.isFinite(opts[k]) && opts[k] > 0))
            fail(who, `${k} must be a number > 0 (got ${opts[k]})`);
    return {
        ...(opts.id === undefined ? {} : { id: opts.id }), ...(opts.width === undefined ? {} : { width: opts.width }), ...(opts.height === undefined ? {} : { height: opts.height }),
        ...(opts.labelRole === undefined ? {} : { labelRole: opts.labelRole }), ...(opts.scope === undefined ? {} : { scope: opts.scope }), ...(opts.reveal === undefined ? {} : { reveal: opts.reveal }), ...(opts.until === undefined ? {} : { until: opts.until }),
    };
}
export function waterfallBand(steps, opts = {}) {
    const spec = resolveWaterfall(steps, opts);
    return { type: 'chart', kind: 'waterfall', spec, alt: opts.alt ?? waterfallAlt(spec), ids: steps.flatMap(s => s.id ? [s.id] : []), ...common('waterfall', opts) };
}
export function tornadoBand(items, opts) {
    const spec = resolveTornado(items, opts);
    return { type: 'chart', kind: 'tornado', spec, alt: opts.alt ?? tornadoAlt(spec), ids: spec.items.flatMap(i => i.id ? [i.id] : []), ...common('tornado', opts) };
}
export function heatmapBand(rows, cols, values, opts) {
    const spec = resolveHeatmap(rows, cols, values, opts);
    return { type: 'chart', kind: 'heatmap', spec, alt: opts.alt ?? heatmapAlt(spec), ids: [], ...common('heatmap', opts) };
}
export function stackedBand(who, columns, mode, opts) {
    const spec = resolveStacked(who, columns, mode, opts);
    return { type: 'chart', kind: 'stacked', spec, alt: opts.alt ?? stackedAlt(spec), ids: columns.flatMap(c => c.id ? [c.id] : []), ...common(who, opts) };
}
export function radarBand(axes, series, opts) {
    const spec = resolveRadar(axes, series, opts);
    return { type: 'chart', kind: 'radar', spec, alt: opts.alt ?? radarAlt(spec), ids: series.flatMap(s => s.id ? [s.id] : []), ...common('radar', opts) };
}
export function treemapBand(tree, opts) {
    const spec = resolveTreemap(tree, opts);
    const ids = [];
    const walk = (n) => { if (n.id)
        ids.push(n.id); n.children?.forEach(walk); };
    spec.nodes.forEach(walk);
    return { type: 'chart', kind: 'treemap', spec, alt: opts.alt ?? treemapAlt(spec), ids, ...common('treemap', opts) };
}
export function sankeyBand(nodes, links, opts) {
    // an icon is resolved here (the shell) and carried on the node, so layout and emit stay free of I/O
    const placed = nodes.map(n => typeof n === 'string' || n.icon === undefined ? n : { ...n, iconGlyph: resolveIcon(n.icon, 'sankey() node "' + n.id + '" icon') });
    const spec = resolveSankey(placed, links, opts);
    return { type: 'chart', kind: 'sankey', spec, alt: opts.alt ?? sankeyAlt(spec), ids: spec.nodes.map(n => n.id), ...common('sankey', opts) };
}
export function catBand(who, data, opts, kind) {
    const spec = resolveCat(who, data, opts, kind);
    return { type: 'chart', kind: 'catplot', spec, alt: opts.alt ?? catAlt(spec), ids: spec.groups.flatMap(g => g.id ? [g.id] : []), ...common(who, opts) };
}
export function distBand(who, data, opts, kind) {
    const spec = resolveDist(who, data, opts, kind);
    return { type: 'chart', kind: 'distplot', spec, alt: opts.alt ?? distAlt(spec), ids: spec.groups.flatMap(g => g.id ? [g.id] : []), ...common(who, opts) };
}
export function multiBand(who, mode, data, opts) {
    const spec = resolveMulti(who, mode, data, opts);
    return { type: 'chart', kind: 'multiplot', spec, alt: opts.alt ?? multiAlt(spec), ids: [], ...common(who, opts) };
}
export function regBand(who, resid, data, opts) {
    const spec = resolveReg(who, resid, data, opts);
    return { type: 'chart', kind: 'regplot', spec, alt: opts.alt ?? regAlt(spec), ids: [], ...common(who, opts) };
}
export function clusterBand(rows, cols, values, opts) {
    const spec = resolveCluster(rows, cols, values, opts);
    return { type: 'chart', kind: 'clustermap', spec, alt: opts.alt ?? clusterAlt(spec), ids: [], ...common('clustermap', opts) };
}
export function bubbleBand(points, opts) {
    const spec = resolveBubble(points, opts);
    return { type: 'chart', kind: 'bubble', spec, alt: opts.alt ?? bubbleAlt(spec), ids: points.flatMap(p => p.id ? [p.id] : []), ...common('bubble', opts) };
}
export function butterflyBand(rows, opts) {
    const spec = resolveButterfly(rows, opts);
    return { type: 'chart', kind: 'butterfly', spec, alt: opts.alt ?? butterflyAlt(spec), ids: spec.rows.flatMap(r => r.id ? [r.id] : []), ...common('butterfly', opts) };
}
export function comboBand(categories, series, opts) {
    const spec = resolveCombo(categories, series, opts);
    return { type: 'chart', kind: 'combo', spec, alt: opts.alt ?? comboAlt(spec), ids: series.flatMap(s => s.id ? [s.id] : []), ...common('combo', opts) };
}
export function harveyBand(rows, cols, values, opts) {
    const spec = resolveHarvey(rows, cols, values, opts);
    return { type: 'chart', kind: 'harvey', spec, alt: opts.alt ?? harveyAlt(spec), ids: spec.rowIds.flatMap(i => i ? [i] : []), ...common('harvey', opts) };
}
