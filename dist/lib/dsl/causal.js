import { causalAlt, resolveCausal } from '../semnet-causal.js';
import { semnetBandOptions } from '../semnet-band-options.js';
import { withAnchors, withHandle } from './shared.js';
function causalBand(nodes, links, opts = {}) {
    const spec = resolveCausal(nodes, links, opts);
    return { type: 'chart', kind: 'causal', spec, alt: opts.alt ?? causalAlt(spec), ids: [...nodes.map(n => n.id), ...spec.interventions.map(v => v.id)], ...semnetBandOptions(opts) };
}
export function causalLoop(nodes, links, opts = {}) {
    const band = causalBand(nodes, links, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
