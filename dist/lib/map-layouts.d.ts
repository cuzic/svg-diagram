import type { TreeLayout, TreeNode } from './graph-layout.ts';
/** Flips a layout left to right (x') or top to bottom: positions, edges and braces. */
export declare function mirror(t: TreeLayout, axis: 'x' | 'y'): TreeLayout;
/**
 * Hanging lists. Every node of a list sits under its parent, indented, and a line drops from the parent and turns into each child
 * (an outline). With `rowFirst` the root's children stand side by side under the root, each with its own list below (an org chart
 * whose lower levels are lists).
 */
export declare function layoutHanging(root: TreeNode, opts?: {
    rowFirst?: boolean;
    gap?: number;
    indent?: number;
    rowGap?: number;
}): TreeLayout;
/** A brace map: a tree growing right whose branches are gathered by `{` braces (the parent's tip, then the children). */
export declare function layoutBrace(root: TreeNode, opts?: {
    gap?: number;
}): TreeLayout;
/**
 * A fishbone (cause and effect): the root is the head on the right, a spine runs to it, each child of the root is a category at
 * the end of a slanted bone (alternately above and below the spine), and its children are causes hung on that bone by short
 * horizontal lines. A cause's own children (and theirs) hang under it as an outline, indented toward the tail, so the fishbone
 * of the QC seven tools (large bone, medium bone, small bone) is three levels under the root, or more.
 */
export declare function layoutFishbone(root: TreeNode, opts?: {
    gap?: number;
}): TreeLayout;
/**
 * A timeline: the root at the left end of a horizontal axis; its children stand along the axis, alternately above and below it,
 * each with its own list (an outline) growing away from the axis.
 */
export declare function layoutTimelineMap(root: TreeNode, opts?: {
    gap?: number;
}): TreeLayout;
