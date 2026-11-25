import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { resolveTornado, tornadoAlt } from '../charts-tornado.js';
export function tornadoBand(items, opts) {
    const spec = resolveTornado(items, opts);
    return { type: 'chart', kind: 'tornado', spec, alt: opts.alt ?? tornadoAlt(spec), ids: spec.items.flatMap(i => i.id ? [i.id] : []), ...chartBandOptions('tornado', opts) };
}
export function tornado(items, opts) {
    const band = tornadoBand(items, opts);
    return withHandle(withAnchors(band, band.ids), opts?.id);
}
