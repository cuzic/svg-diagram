import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { comboAlt, resolveCombo } from '../charts-combo.js';
export function comboBand(categories, series, opts) {
    const spec = resolveCombo(categories, series, opts);
    return { type: 'chart', kind: 'combo', spec, alt: opts.alt ?? comboAlt(spec), ids: series.flatMap(s => s.id ? [s.id] : []), ...chartBandOptions('combo', opts) };
}
export function combo(categories, series, opts = {}) {
    const band = comboBand(categories, series, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
