import { withAnchors, withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { resolveTreemap, treemapAlt } from '../charts-treemap.js';
export function treemapBand(tree, opts) {
    const spec = resolveTreemap(tree, opts);
    const ids = [];
    const walk = (n) => { if (n.id)
        ids.push(n.id); n.children?.forEach(walk); };
    spec.nodes.forEach(walk);
    return { type: 'chart', kind: 'treemap', spec, alt: opts.alt ?? treemapAlt(spec), ids, ...chartBandOptions('treemap', opts) };
}
export function treemap(tree, opts = {}) {
    const band = treemapBand(tree, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
