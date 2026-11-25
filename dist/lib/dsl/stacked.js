import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { resolveStacked, stackedAlt } from '../charts-stacked.js';
export function stackedBand(who, columns, mode, opts) {
    const spec = resolveStacked(who, columns, mode, opts);
    return { type: 'chart', kind: 'stacked', spec, alt: opts.alt ?? stackedAlt(spec), ids: columns.flatMap(c => c.id ? [c.id] : []), ...chartBandOptions(who, opts) };
}
export function stackedBars(columns, opts = {}) {
    const band = stackedBand('stackedBars', columns, opts.percent ? 'percent' : 'stacked', opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
export function mekko(columns, opts = {}) {
    const band = stackedBand('mekko', columns, 'mekko', opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
