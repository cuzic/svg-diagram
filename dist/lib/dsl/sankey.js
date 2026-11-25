import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { resolveSankey, sankeyAlt } from '../charts-sankey.js';
import { resolveIcon } from '../icon-registry.js';
export function sankeyBand(nodes, links, opts) {
    // an icon is resolved here (the shell) and carried on the node, so layout and emit stay free of I/O
    const placed = nodes.map(n => typeof n === 'string' || n.icon === undefined ? n : { ...n, iconGlyph: resolveIcon(n.icon, 'sankey() node "' + n.id + '" icon') });
    const spec = resolveSankey(placed, links, opts);
    return { type: 'chart', kind: 'sankey', spec, alt: opts.alt ?? sankeyAlt(spec), ids: spec.nodes.map(n => n.id), ...chartBandOptions('sankey', opts) };
}
export function sankey(nodes, links, opts = {}) {
    const band = sankeyBand(nodes, links, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
