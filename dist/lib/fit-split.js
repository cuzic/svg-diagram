import { must } from './must.js';
const MAX_NAMES = 6;
const names = (ids) => ids.slice(0, MAX_NAMES).join(', ') + (ids.length > MAX_NAMES ? ', …' : '');
/**
 * A figure too tall for its height budget (its layers lie along the height): the boundary between two layers where both halves fit the budget, with the
 * fewest arrows across it, then the most even number of nodes. `lay` is in layout coordinates, the layers along x. A return (a reversed edge) is not counted.
 * None fits: say that three or more figures are needed.
 */
export function splitByHeight(lay, budget) {
    const layerOf = (id) => must(lay.layers.get(id)); // every node and edge end of a layered layout has a layer
    const real = [...lay.nodes.entries()].map(([id, p]) => ({ id, layer: layerOf(id), from: p.x, to: p.x + p.w }));
    const top = Math.max(...real.map(n => n.layer));
    if (top < 1)
        return undefined;
    const span = (ns) => ns.length ? Math.max(...ns.map(n => n.to)) - Math.min(...ns.map(n => n.from)) : 0;
    let best;
    for (let k = 0; k < top; k++) {
        const up = real.filter(n => n.layer <= k), down = real.filter(n => n.layer > k);
        if (span(up) > budget || span(down) > budget)
            continue;
        const across = lay.edges.filter(e => !e.self && !e.reversed && Math.min(layerOf(e.from), layerOf(e.to)) <= k && Math.max(layerOf(e.from), layerOf(e.to)) > k);
        const cand = { k, across: across.map(e => `${e.from}→${e.to}`), diff: Math.abs(up.length - down.length) };
        if (!best || cand.across.length < best.across.length || (cand.across.length === best.across.length && cand.diff < best.diff))
            best = cand;
    }
    if (!best)
        return 'no cut between two layers leaves both halves within the height: three or more figures are needed';
    return `after layer ${best.k + 1} (${best.across.length} arrow${best.across.length === 1 ? '' : 's'} cross${best.across.length === 1 ? 'es' : ''}: ${names(best.across)}). Draw the nodes up to that layer in one figure and the rest in another, repeating the nodes the arrows cross to in both`;
}
/** A figure too wide (one layer is wider than the figure): that layer and its nodes. A cut between layers does not help; the layer has to be shared out between two figures. */
export function splitWidest(lay) {
    const byLayer = new Map();
    for (const [id, p] of lay.nodes) {
        const l = must(lay.layers.get(id));
        byLayer.set(l, [...(byLayer.get(l) ?? []), { id, from: p.y, to: p.y + p.h }]);
    }
    let widest;
    for (const [layer, ns] of byLayer) {
        const across = Math.max(...ns.map(n => n.to)) - Math.min(...ns.map(n => n.from));
        if (!widest || across > widest.across)
            widest = { layer, ids: ns.map(n => n.id), across };
    }
    if (!widest || widest.ids.length < 2)
        return undefined;
    return `layer ${widest.layer + 1} is the widest (${widest.ids.length} nodes: ${names(widest.ids)}). Share its nodes between two figures, each with the branch that leads from them`;
}
