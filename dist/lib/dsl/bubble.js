import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { bubbleAlt, resolveBubble } from '../charts-bubble.js';
export function bubbleBand(points, opts) {
    const spec = resolveBubble(points, opts);
    return { type: 'chart', kind: 'bubble', spec, alt: opts.alt ?? bubbleAlt(spec), ids: points.flatMap(p => p.id ? [p.id] : []), ...chartBandOptions('bubble', opts) };
}
export function bubble(points, opts = {}) {
    const band = bubbleBand(points, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
