import { burndownOpts, burnupOpts, linesOpts, strategyCanvasOpts } from '../charts-lines.js';
import { bubbleBand, butterflyBand, comboBand, harveyBand, heatmapBand, radarBand, sankeyBand, treemapBand, stackedBand, tornadoBand, waterfallBand } from '../charts-dsl.js';
import { causalBand, dependencyBand, pertBand } from '../semnet-dsl.js';
import { plane } from './figures.js';
import { withAnchors, withHandle } from './shared.js';
export function waterfall(steps, opts = {}) {
    const band = waterfallBand(steps, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function pert(tasks, opts = {}) { const band = pertBand(tasks, opts); return withHandle(withAnchors(band, band.ids), opts.id); }
export function causalLoop(nodes, links, opts = {}) { const band = causalBand(nodes, links, opts); return withHandle(withAnchors(band, band.ids), opts.id); }
export function dependencyNetwork(nodes, edges, opts = {}) { const band = dependencyBand(nodes, edges, opts); return withHandle(withAnchors(band, band.ids), opts.id); }
export function radar(axes, series, opts = {}) {
    const band = radarBand(axes, series, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function lines(series, opts = {}) {
    return plane(linesOpts(series, opts));
}
export function strategyCanvas(factors, series, opts = {}) {
    return lines(...strategyCanvasOpts(factors, series, opts));
}
export function burndown(spec, opts = {}) {
    return lines(...burndownOpts(spec, opts));
}
export function burnup(spec, opts = {}) {
    return lines(...burnupOpts(spec, opts));
}
export function sankey(nodes, links, opts = {}) {
    const band = sankeyBand(nodes, links, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function treemap(tree, opts = {}) {
    const band = treemapBand(tree, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function stackedBars(columns, opts = {}) {
    const band = stackedBand('stackedBars', columns, opts.percent ? 'percent' : 'stacked', opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function mekko(columns, opts = {}) {
    const band = stackedBand('mekko', columns, 'mekko', opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function heatmap(rows, cols, values, opts = {}) {
    return withHandle(heatmapBand(rows, cols, values, opts), opts.id);
}
export function tornado(items, opts) {
    const band = tornadoBand(items, opts);
    return withHandle(withAnchors(band, band.ids), opts?.id);
}
export function bubble(points, opts = {}) {
    const band = bubbleBand(points, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function butterfly(rows, opts) {
    const band = butterflyBand(rows, opts);
    return withHandle(withAnchors(band, band.ids), opts?.id);
}
export function combo(categories, series, opts = {}) {
    const band = comboBand(categories, series, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function harvey(rows, cols, values, opts = {}) {
    const band = harveyBand(rows, cols, values, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
