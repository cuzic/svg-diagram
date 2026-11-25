import { fail } from './charts-base.js';
import { must } from './must.js';
/** All directed simple cycles, once each, ordered by node input order. */
export function analyzeCausalLoops(nodes, links) {
    const index = new Map();
    nodes.forEach((id, i) => { if (!id || index.has(id))
        fail('causalLoop', `node ids must be non-empty and unique (got "${id}")`); index.set(id, i); });
    const out = new Map(nodes.map(id => [id, []]));
    links.forEach((e, i) => {
        if (!index.has(e.from) || !index.has(e.to))
            fail('causalLoop', `link ${e.from} -> ${e.to} names unknown node`);
        if (!['+', '-', 'same', 'opposite'].includes(e.polarity))
            fail('causalLoop', `link ${e.from} -> ${e.to} has invalid polarity "${String(e.polarity)}"`);
        must(out.get(e.from)).push({ to: e.to, edge: i });
    });
    const cycles = [];
    nodes.forEach((start, si) => {
        const path = [start], edges = [], seen = new Set([start]);
        const visit = (at) => {
            for (const e of must(out.get(at))) {
                if (e.to === start) {
                    const linkIndexes = [...edges, e.edge], negativeLinks = linkIndexes.filter(i => ['-', 'opposite'].includes(must(links[i]).polarity)).length;
                    cycles.push({ nodes: [...path], linkIndexes, negativeLinks, kind: negativeLinks % 2 ? 'B' : 'R' });
                }
                else if (!seen.has(e.to) && must(index.get(e.to)) >= si) {
                    seen.add(e.to);
                    path.push(e.to);
                    edges.push(e.edge);
                    visit(e.to);
                    edges.pop();
                    path.pop();
                    seen.delete(e.to);
                }
            }
        };
        visit(start);
    });
    return cycles;
}
