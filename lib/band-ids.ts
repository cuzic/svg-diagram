// The ids a self-placing band (tree, mindmap, state diagram, gantt, class diagram, bpmn) gives to its nodes, read from the band as
// written (before layout). reveal.ts gives each the band's own stage, so a connect() to a node appears with the figure.
import {treeItems} from './tree.ts';
import type {Band} from './types.ts';

export function nodeIdsOf(b: Band): string[] {
  switch (b.type) {
    case 'tree': return treeItems(b.root).flatMap(n => n.id ? [n.id] : []);
    case 'states': return b.states.map(s => s.id);
    case 'gantt': return b.rows.flatMap(r => 'id' in r && r.id ? [r.id] : []);
    case 'classes': return b.classes.map(c => c.id);
    default: return [];
  }
}
