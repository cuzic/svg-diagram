import { withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { heatmapAlt, resolveHeatmap } from '../charts-heatmap.js';
export function heatmapBand(rows, cols, values, opts) {
    const spec = resolveHeatmap(rows, cols, values, opts);
    return { type: 'chart', kind: 'heatmap', spec, alt: opts.alt ?? heatmapAlt(spec), ids: [], ...chartBandOptions('heatmap', opts) };
}
export function heatmap(rows, cols, values, opts = {}) {
    return withHandle(heatmapBand(rows, cols, values, opts), opts.id);
}
