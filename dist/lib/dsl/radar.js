import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { radarAlt, resolveRadar } from '../charts-radar.js';
export function radarBand(axes, series, opts) {
    const spec = resolveRadar(axes, series, opts);
    return { type: 'chart', kind: 'radar', spec, alt: opts.alt ?? radarAlt(spec), ids: series.flatMap(s => s.id ? [s.id] : []), ...chartBandOptions('radar', opts) };
}
export function radar(axes, series, opts = {}) {
    const band = radarBand(axes, series, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
