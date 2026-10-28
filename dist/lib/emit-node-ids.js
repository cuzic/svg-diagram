// Node names in the SVG (ADR 0034, opt-in): `data-node="name"` on the frame of a node, so a page that shows the SVG can tell which node
// a click or a mark belongs to. Off by default: no drawing changes unless the caller asks (emitSvg({nodeIds: true})).
//
// The name is the one connect() and spotlight use: `scope.id`, or the bare id when the band has no scope (ADR 0012). A name the maker
// gave itself (whyWhyTree's `unanchored`) is not one an author can use, so it gets none.
//
// A flow shape (chevron / funnel / cycle / venn / concentric / emblem) names the frame of each item that has an id; a quadrant names the marker
// and the label of each item that has an id (the two are separate elements, so both carry it).
//
// withNodeIds copies the laid-out bands with `dataNode` set on each node that has a name and is drawn as a plain rectangle; the emitters
// pass the node on to renderBoxRect as they always did, and it writes the attribute. Nothing about how a node is drawn changes. A node drawn
// as something else (a hexagon, an event, a gateway) gets none: there is no frame element to carry it.
import { qualify, scopeOf } from './scope-name.js';
const nameBox = (b) => b.id && b.frame !== false ? { ...b, dataNode: qualify(scopeOf(b), b.id) } : b; // a row's or a grid's boxes are registered without a scope of the row's
export function withNodeIdsBand(band) {
    const scope = scopeOf(band);
    switch (band.type) {
        case 'box': return nameBox(band);
        case 'row':
        case 'grid': return { ...band, children: band.children.map(nameBox) };
        case 'tree': return { ...band, nodes: band.nodes.map(n => n.id ? { ...n, dataNode: qualify(scope, n.id) } : n) };
        case 'cause': return { ...band, nodes: band.nodes.map((n, i) => {
                const id = band.anchors[i]?.id;
                return id !== undefined && !n.hex && !band.unanchored?.includes(id) ? { ...n, dataNode: qualify(scope, id) } : n;
            }) };
        case 'bpmn': return { ...band, nodes: band.nodes.map((n, i) => {
                const id = band.anchors[i]?.id;
                return id !== undefined && n.kind === 'task' ? { ...n, dataNode: qualify(scope, id) } : n;
            }) };
        case 'chevron':
        case 'funnel':
        case 'cycle':
        case 'venn':
        case 'concentric':
        case 'emblem':
            return { ...band, primitives: band.primitives.map(p => 'node' in p && p.node !== undefined ? { ...p, dataNode: qualify(scope, p.node) } : p) };
        case 'quadrant': { // the marker and every line of the name carry it: a click on either finds the item
            const name = (i) => { const id = i === undefined ? undefined : band.bubbles[i]?.id; return id === undefined ? undefined : qualify(scope, id); };
            return { ...band,
                bubbles: band.bubbles.map(q => q.id === undefined ? q : { ...q, dataNode: qualify(scope, q.id) }),
                texts: band.texts.map(t => { const n = name(t.item); return n === undefined ? t : { ...t, dataNode: n }; }) };
        }
        default: return band;
    }
}
/** The laid-out diagram with the names of its nodes on them. */
export const withNodeIds = (d) => ({ ...d, laidOut: d.laidOut.map(withNodeIdsBand) });
