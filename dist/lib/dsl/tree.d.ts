import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { TreeBand, TreeItem, TreeOpts, MindmapOpts } from '../types/diagrams.ts';
import type { TreeIds } from './shared.ts';
export declare function tree<const R extends TreeItem, const Id extends string = never>(root: R, opts?: TreeOpts & {
    id?: Id;
}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
/**
 * A mind map: the root in the middle, its children split to the right and the left (balanced by height, in the order
 * written: the right side first), each branch growing outward. Nodes are the same as tree()'s; `sides` pins a child of the root.
 *   mindmap({label: '新機能', children: [{label: '目的', children: [...]}, {label: '課題', id: 'issues'}]}, {sides: {issues: 'left'}})
 */
export declare function mindmap<const R extends TreeItem, const Id extends string = never>(root: R, opts?: MindmapOpts & {
    id?: Id;
}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
