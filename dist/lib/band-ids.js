// The ids a self-placing band (tree, mindmap, state diagram, gantt, class diagram, bpmn) gives to its nodes, read from the band as
// written (before layout). reveal.ts gives each the band's own stage, so a connect() to a node appears with the figure.
import { treeItems } from './tree.js';
import { ftaIds } from './fta.js';
import { quadrantIds } from './quadrant.js';
import { flowShapeIds } from './flow-shapes.js';
import { qualify } from './scope-name.js';
const qual = (b, ids) => { const s = b.scope; return s ? ids.map(id => qualify(s, id)) : ids; };
/** The names a self-placing band's nodes are registered under (qualified with the band's `scope`, when it has one). */
export function nodeIdsOf(b) { return qual(b, bareNodeIds(b)); }
/** Every item id a band gives (bare): its nodes, and the bars / marks / steps that layout registers one by one. */
export function itemIdsOf(b) {
    const own = (xs) => xs.flatMap(x => x.id ? [x.id] : []);
    switch (b.type) {
        case 'bars': return own(b.data);
        case 'image': return own(b.marks ?? []);
        case 'swimlane': return own(b.steps);
        default: return bareNodeIds(b);
    }
}
function bareNodeIds(b) {
    switch (b.type) {
        case 'chart': return b.ids;
        case 'tree': return treeItems(b.root).flatMap(n => n.id ? [n.id] : []);
        case 'states': return b.states.map(s => s.id);
        case 'cause': return b.nodes.filter(n => !b.unanchored?.includes(n.id)).map(n => n.id);
        case 'cloud': return ['a', 'b', 'c', 'd', 'd2'].flatMap(k => { const v = b[k]; return typeof v !== 'string' && v.id ? [v.id] : []; });
        case 'gantt': return b.rows.flatMap(r => 'id' in r && r.id ? [r.id] : []);
        case 'classes': return b.classes.map(c => c.id);
        case 'bpmn': return b.nodes.map(n => n.id);
        case 'fta': return ftaIds(b.root);
        case 'quadrant': return quadrantIds(b);
        case 'chevron':
        case 'funnel':
        case 'cycle':
        case 'venn':
        case 'concentric':
        case 'emblem': return flowShapeIds(b);
        default: return [];
    }
}
