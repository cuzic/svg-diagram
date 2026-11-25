import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { harveyAlt, resolveHarvey } from '../charts-harvey.js';
export function harveyBand(rows, cols, values, opts) {
    const spec = resolveHarvey(rows, cols, values, opts);
    return { type: 'chart', kind: 'harvey', spec, alt: opts.alt ?? harveyAlt(spec), ids: spec.rowIds.flatMap(i => i ? [i] : []), ...chartBandOptions('harvey', opts) };
}
export function harvey(rows, cols, values, opts = {}) {
    const band = harveyBand(rows, cols, values, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
