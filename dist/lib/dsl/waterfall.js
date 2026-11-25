import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { resolveWaterfall, waterfallAlt } from '../charts-waterfall.js';
export function waterfallBand(steps, opts = {}) {
    const spec = resolveWaterfall(steps, opts);
    return { type: 'chart', kind: 'waterfall', spec, alt: opts.alt ?? waterfallAlt(spec), ids: steps.flatMap(s => s.id ? [s.id] : []), ...chartBandOptions('waterfall', opts) };
}
export function waterfall(steps, opts = {}) {
    const band = waterfallBand(steps, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
