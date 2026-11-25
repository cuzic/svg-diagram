// Node names in the SVG (ADR 0034, opt-in): `data-node="name"` on the frame of a node, so a page that shows the SVG can tell which node
// a click or a mark belongs to. Off by default: no drawing changes unless the caller asks (emitSvg({nodeIds: true})).
//
// The name is the one connect() and spotlight use: `scope.id`, or the bare id when the band has no scope (ADR 0012). A name the maker
// gave itself (whyWhyTree's `unanchored`) is not one an author can use, so it gets none.
//
// A flow shape (chevron / funnel / cycle / venn / concentric / emblem) names the frame of each item that has an id; a quadrant names the marker
// and the label of each item that has an id (the two are separate elements, so both carry it).
//
// Each band names its own nodes: a band definition's `nameNodes` hook (the helpers below are the ones the built-in definitions share).
// withNodeIds copies the laid-out bands with `dataNode` set on each node that has a name and is drawn as a plain rectangle; the emitters
// pass the node on to renderBoxRect as they always did, and it writes the attribute. Nothing about how a node is drawn changes. A node drawn
// as something else (a hexagon, an event, a gateway) gets none: there is no frame element to carry it.
import type {BandDef} from './band-def.ts';
import {defOf} from './band-def.ts';
import type {LaidOutFlowShape} from './flow-shapes.ts';
import type {LaidOutQuadrant} from './quadrant.ts';
import {qualify, scopeOf} from './scope-name.ts';
import type {LaidOutGrid, LaidOutRow} from './types/containers.ts';
import type {LaidOutBpmn, LaidOutCause, LaidOutTree} from './types/diagrams.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {LaidOutBox} from './types/text-bands.ts';

const nameBox = (b: LaidOutBox): LaidOutBox => b.id && b.frame !== false ? {...b, dataNode: qualify(scopeOf(b), b.id)} : b; // a row's or a grid's boxes are registered without a scope of the row's

export const nameBoxNode = (band: LaidOutBox): LaidOutBox => nameBox(band);
export const nameBoxChildren = <B extends LaidOutRow | LaidOutGrid>(band: B): B => ({...band, children: band.children.map(nameBox)});
export const nameTreeNodes = (band: LaidOutTree): LaidOutTree => {
  const scope = scopeOf(band);
  return {...band, nodes: band.nodes.map(n => n.id ? {...n, dataNode: qualify(scope, n.id)} : n)};
};
export const nameCauseNodes = (band: LaidOutCause): LaidOutCause => {
  const scope = scopeOf(band);
  return {...band, nodes: band.nodes.map((n, i) => { // anchors[i] is the name of nodes[i] (the layout builds both from the same list)
    const id = band.anchors[i]?.id;
    return id !== undefined && !n.hex && !band.unanchored?.includes(id) ? {...n, dataNode: qualify(scope, id)} : n;
  })};
};
export const nameBpmnNodes = (band: LaidOutBpmn): LaidOutBpmn => {
  const scope = scopeOf(band);
  return {...band, nodes: band.nodes.map((n, i) => {
    const id = band.anchors[i]?.id;
    return id !== undefined && n.kind === 'task' ? {...n, dataNode: qualify(scope, id)} : n;
  })};
};
export const nameFlowShapeNodes = (band: LaidOutFlowShape): LaidOutFlowShape => {
  const scope = scopeOf(band);
  return {...band, primitives: band.primitives.map(p => 'node' in p && p.node !== undefined ? {...p, dataNode: qualify(scope, p.node)} : p)} as LaidOutFlowShape;
};
/** The marker and every line of the name carry it: a click on either finds the item. */
export const nameQuadrantNodes = (band: LaidOutQuadrant): LaidOutQuadrant => {
  const scope = scopeOf(band);
  const name = (i: number | undefined): string | undefined => { const id = i === undefined ? undefined : band.bubbles[i]?.id; return id === undefined ? undefined : qualify(scope, id); };
  return {...band,
    bubbles: band.bubbles.map(q => q.id === undefined ? q : {...q, dataNode: qualify(scope, q.id)}),
    texts: band.texts.map(t => { const n = name(t.item); return n === undefined ? t : {...t, dataNode: n}; })};
};

type DefinitionOf = (band: LaidOutBand) => BandDef | undefined;

/** The band with its nodes named by its definition; a band whose definition names none is returned as it is. */
export function withNodeIdsBand(band: LaidOutBand, definitionOf: DefinitionOf = defOf): LaidOutBand {
  return definitionOf(band)?.nameNodes?.(band as never) as LaidOutBand | undefined ?? band;
}

/** The laid-out diagram with the names of its nodes on them. */
export const withNodeIds = (d: LaidOutDiagram, definitionOf: DefinitionOf = defOf): LaidOutDiagram => ({...d, laidOut: d.laidOut.map(band => withNodeIdsBand(band, definitionOf))});
