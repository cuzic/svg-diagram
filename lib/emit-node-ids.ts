// Node names in the SVG (ADR 0034, opt-in): `data-node="name"` on the frame of a node, so a page that shows the SVG can tell which node
// a click or a mark belongs to. Off by default: no drawing changes unless the caller asks (emitSvg({nodeIds: true})).
//
// The name is the one connect() and spotlight use: `scope.id`, or the bare id when the band has no scope (ADR 0012). A name the maker
// gave itself (whyWhyTree's `unanchored`) is not one an author can use, so it gets none.
//
// withNodeIds copies the laid-out bands with `dataNode` set on each node that has a name and is drawn as a plain rectangle; the emitters
// pass the node on to renderBoxRect as they always did, and it writes the attribute. Nothing about how a node is drawn changes. A node drawn
// as something else (a hexagon, an event, a gateway) gets none: there is no frame element to carry it.
import {qualify, scopeOf} from './scope-name.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {LaidOutBox} from './types/text-bands.ts';

const nameBox = (b: LaidOutBox, scope: string | undefined): LaidOutBox => b.id && b.frame !== false ? {...b, dataNode: qualify(scopeOf(b) ?? scope, b.id)} : b;

export function withNodeIdsBand(band: LaidOutBand): LaidOutBand {
  const scope = scopeOf(band);
  switch (band.type) {
    case 'box': return nameBox(band, undefined) as LaidOutBand;
    case 'row': case 'grid': return {...band, children: band.children.map(c => nameBox(c, scope))} as LaidOutBand;
    case 'tree': return {...band, nodes: band.nodes.map(n => n.id ? {...n, dataNode: qualify(scope, n.id)} : n)};
    case 'cause': return {...band, nodes: band.nodes.map((n, i) => { // anchors[i] is the name of nodes[i] (the layout builds both from the same list)
      const id = band.anchors[i]?.id;
      return id !== undefined && !n.hex && !band.unanchored?.includes(id) ? {...n, dataNode: qualify(scope, id)} : n;
    })};
    case 'bpmn': return {...band, nodes: band.nodes.map((n, i) => {
      const id = band.anchors[i]?.id;
      return id !== undefined && n.kind === 'task' ? {...n, dataNode: qualify(scope, id)} : n;
    })};
    default: return band;
  }
}

/** The laid-out diagram with the names of its nodes on them. */
export const withNodeIds = (d: LaidOutDiagram): LaidOutDiagram => ({...d, laidOut: d.laidOut.map(withNodeIdsBand)});
