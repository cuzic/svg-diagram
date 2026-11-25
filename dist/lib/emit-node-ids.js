import { defOf } from './band-def.js';
import { qualify, scopeOf } from './scope-name.js';
const nameBox = (b) => b.id && b.frame !== false ? { ...b, dataNode: qualify(scopeOf(b), b.id) } : b; // a row's or a grid's boxes are registered without a scope of the row's
export const nameBoxNode = (band) => nameBox(band);
export const nameBoxChildren = (band) => ({ ...band, children: band.children.map(nameBox) });
export const nameTreeNodes = (band) => {
    const scope = scopeOf(band);
    return { ...band, nodes: band.nodes.map(n => n.id ? { ...n, dataNode: qualify(scope, n.id) } : n) };
};
export const nameCauseNodes = (band) => {
    const scope = scopeOf(band);
    return { ...band, nodes: band.nodes.map((n, i) => {
            const id = band.anchors[i]?.id;
            return id !== undefined && !n.hex && !band.unanchored?.includes(id) ? { ...n, dataNode: qualify(scope, id) } : n;
        }) };
};
export const nameBpmnNodes = (band) => {
    const scope = scopeOf(band);
    return { ...band, nodes: band.nodes.map((n, i) => {
            const id = band.anchors[i]?.id;
            return id !== undefined && n.kind === 'task' ? { ...n, dataNode: qualify(scope, id) } : n;
        }) };
};
export const nameFlowShapeNodes = (band) => {
    const scope = scopeOf(band);
    return { ...band, primitives: band.primitives.map(p => 'node' in p && p.node !== undefined ? { ...p, dataNode: qualify(scope, p.node) } : p) };
};
/** The marker and every line of the name carry it: a click on either finds the item. */
export const nameQuadrantNodes = (band) => {
    const scope = scopeOf(band);
    const name = (i) => { const id = i === undefined ? undefined : band.bubbles[i]?.id; return id === undefined ? undefined : qualify(scope, id); };
    return { ...band,
        bubbles: band.bubbles.map(q => q.id === undefined ? q : { ...q, dataNode: qualify(scope, q.id) }),
        texts: band.texts.map(t => { const n = name(t.item); return n === undefined ? t : { ...t, dataNode: n }; }) };
};
/** The band with its nodes named by its definition; a band whose definition names none is returned as it is. */
export function withNodeIdsBand(band, definitionOf = defOf) {
    return definitionOf(band)?.nameNodes?.(band) ?? band;
}
/** The laid-out diagram with the names of its nodes on them. */
export const withNodeIds = (d, definitionOf = defOf) => ({ ...d, laidOut: d.laidOut.map(band => withNodeIdsBand(band, definitionOf)) });
