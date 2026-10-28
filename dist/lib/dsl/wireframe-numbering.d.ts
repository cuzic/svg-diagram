import type { Band } from '../types/index.ts';
import type { WfOverlay } from '../types/wireframe-nodes.ts';
import type { WfRoot, WireframeDefaults } from '../types/wireframe.ts';
export interface Numbering {
    /** One per `n: true` found, in reading order: each writes the number it is given back into its callout. */
    todo: ((n: number) => void)[];
    /** The largest number written explicitly. */
    max: number;
}
export declare const NUMBERING: unique symbol;
export type NumberTrees = (WfRoot | WfOverlay | WfOverlay[] | undefined)[];
/** `skip`: nodes that are not walked (nor descended into) — used to number only a shell, not the content it wraps. */
export declare function collectNumbering(skip: Set<object> | null, trees: NumberTrees): Numbering;
export declare const assignNumbers: (max: number, ...groups: Numbering['todo'][]) => void;
export declare function autoNumber(...trees: NumberTrees): Numbering;
/** Every node of a tree (so a shell can tell its own nodes from the content's). */
export declare function nodesOf(root: WfRoot): Set<object>;
export declare const SHELLED: WeakSet<object>;
export declare function applyWireframeDefaults(bands: Band[], defaults: WireframeDefaults): Band[];
