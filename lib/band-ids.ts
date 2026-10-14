// The ids a self-placing band (tree, mindmap, state diagram, gantt, class diagram, bpmn) gives to its nodes, read from the band as
// written (before layout). reveal.ts gives each the band's own stage, so a connect() to a node appears with the figure.
import {treeItems} from './tree.ts';
import {quadrantIds} from './quadrant.ts';
import {flowShapeIds} from './flow-shapes.ts';
import type {Band} from './types/index.ts';

export function nodeIdsOf(b: Band): string[] {
  switch (b.type) {
    case 'chart': return b.ids;
    case 'tree': return treeItems(b.root).flatMap(n => n.id ? [n.id] : []);
    case 'states': return b.states.map(s => s.id);
    case 'cause': return b.nodes.map(n => n.id);
    case 'cloud': return (['a', 'b', 'c', 'd', 'd2'] as const).flatMap(k => { const v = b[k]; return typeof v !== 'string' && v.id ? [v.id] : []; });
    case 'gantt': return b.rows.flatMap(r => 'id' in r && r.id ? [r.id] : []);
    case 'classes': return b.classes.map(c => c.id);
    case 'bpmn': return b.nodes.map(n => n.id);
    case 'quadrant': return quadrantIds(b);
    case 'chevron': case 'funnel': case 'cycle': case 'venn': case 'concentric': return flowShapeIds(b);
    default: return [];
  }
}
