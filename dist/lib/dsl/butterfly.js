import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { butterflyAlt, resolveButterfly } from '../charts-butterfly.js';
export function butterflyBand(rows, opts) {
    const spec = resolveButterfly(rows, opts);
    return { type: 'chart', kind: 'butterfly', spec, alt: opts.alt ?? butterflyAlt(spec), ids: spec.rows.flatMap(r => r.id ? [r.id] : []), ...chartBandOptions('butterfly', opts) };
}
export function butterfly(rows, opts) {
    const band = butterflyBand(rows, opts);
    return withHandle(withAnchors(band, band.ids), opts?.id);
}
