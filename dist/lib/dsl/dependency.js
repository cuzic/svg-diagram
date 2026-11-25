import { dependencyAlt, resolveDependency } from '../semnet-dependency.js';
import { semnetBandOptions } from '../semnet-band-options.js';
import { withAnchors, withHandle } from './shared.js';
function dependencyBand(nodes, edges, opts = {}) {
    const spec = resolveDependency(nodes, edges, opts);
    return { type: 'chart', kind: 'dependency', spec, alt: opts.alt ?? dependencyAlt(spec), ids: nodes.map(n => n.id), ...semnetBandOptions(opts) };
}
export function dependencyNetwork(nodes, edges, opts = {}) {
    const band = dependencyBand(nodes, edges, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
