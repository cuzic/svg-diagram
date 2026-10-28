export interface Size {
    w: number;
    h: number;
}
export interface Placed extends Size {
    x: number;
    y: number;
}
export interface Pt {
    x: number;
    y: number;
}
export type Dir = 'down' | 'right';
export interface TreeNode {
    id: string;
    size: Size;
    children?: TreeNode[];
}
export interface TreeOpts {
    dir?: Dir; /** space between siblings */
    gap?: number; /** space between a level and the next */
    levelGap?: number;
}
/** A `{` brace gathering the children of one parent (map-layouts.ts): its spine at x from y1 to y2, the tip at (tipX, ymid) pointing at the parent. */
export interface Brace {
    x: number;
    y1: number;
    y2: number;
    ymid: number;
    tipX: number;
    side: 'right' | 'left';
}
export interface TreeLayout {
    nodes: Map<string, Placed>;
    /** parent -> child polylines (centre to centre, elbow at the half-way level); `curve`: drawn as a smooth S along that axis; `bold`: a spine */
    edges: {
        from: string;
        to: string;
        points: Pt[];
        curve?: 'x' | 'y';
        bold?: boolean;
    }[];
    braces?: Brace[];
    w: number;
    h: number;
}
/**
 * A tidy tree. Levels are aligned (every node of a level starts at the same depth offset), a parent is centred over its
 * children, and a subtree never overlaps its sibling. Not the most compact tree (no contour packing) but never overlaps and
 * reads as an org chart.
 */
export declare function layoutTree(root: TreeNode, opts?: TreeOpts): TreeLayout;
/**
 * A mind map: the root in the middle, its children split into a right and a left half (balanced by height, input order kept
 * inside each half), each half a tree growing outward. `sides` pins a child to a side.
 */
export declare function layoutBalanced(root: TreeNode, opts?: Omit<TreeOpts, 'dir'> & {
    sides?: Record<string, 'left' | 'right'>;
}): TreeLayout;
export interface LayeredNode {
    id: string;
    size: Size;
}
export interface LayeredEdge {
    from: string;
    to: string;
}
export interface LayeredOpts {
    dir?: Dir;
    gap?: number;
    levelGap?: number; /** crossing-reduction sweeps (default 4) */
    sweeps?: number;
    /** Pull a node that only has edges going out (no edge into it, not a `start`) down to just before its nearest target, so its edges stop being long (default false: the longest-path layer, layer 0). */
    tighten?: boolean;
    /** ALAP (ADR 0019 D1): every node of the input side (no edge into it, or only edges from other such nodes) moves down to just before its nearest target, in turn from the targets back,
     *  so a chain of inputs (obstacle → action → goal) is short too. `keep` ids stay on their longest-path layer (and so do `start` nodes). Layers only grow; the cycle breaking is not changed. Default: off. */
    alap?: {
        keep: readonly string[];
    };
    /** Keep the order with the fewest crossings seen in the sweeps, then swap neighbours in a layer while that cuts crossings (default false: the order the last sweep left). */
    transpose?: boolean;
    /** How the across coordinates are found: 'relax' (default: centre each layer, then pull toward the neighbours) or 'bk' (Brandes-Köpf: long edges and chains come out straight). */
    coord?: 'relax' | 'bk';
    /**
     * Returns (reversed edges) that skip two layers or more run in a lane outside the figure instead of through dummies: `which` is 'all'
     * of them or only the `declared` ones (`back`). The first lane is `gap` beyond the boxes on the far across side, the next ones `step` further out,
     * the longest return outermost. Such an edge comes out with `outer` set and four points (its two centres and two points on its lane); the router draws it.
     */
    outer?: {
        which: 'all' | 'declared';
        gap: number;
        step: number; /** which side of the figure a return's lane is on: 'far' (default) past the boxes on the high across side, 'near' on the side its two ends are nearer to (fewer arrows to cross on the way to the lane), 'low' all of them on the low across side */
        side?: 'far' | 'near' | 'low';
    };
    /**
     * The most a row may take on the across axis (ADR 0010 D7). A layer whose nodes (and the dummies of the arrows passing through it) add up to more is cut,
     * in input order, into rows, and each row is a layer of its own (the later layers move down one number per row), so the corridors between layers still
     * hold. A layer that fits is not touched; without `fold` nothing is added to the layering. `folded` in the result lists the layers that were cut.
     */
    fold?: number;
}
export interface LayeredEdgeOut {
    from: string;
    to: string; /** index of this edge in the input list */
    index: number; /** centre to centre, through the layers it skips; reversed edges are drawn from `from` anyway */
    points: Pt[];
    reversed: boolean;
    self: boolean; /** runs in an outer lane (see LayeredOpts.outer) */
    outer?: true;
}
export interface LayeredLayout {
    nodes: Map<string, Placed>;
    edges: LayeredEdgeOut[]; /** layer index of each node (0 = first) */
    layers: Map<string, number>;
    w: number;
    h: number; /** only with `fold`, when a layer was cut: its number before the cut (from 0) and the rows it became */
    folded?: {
        layer: number;
        rows: number;
    }[];
}
/**
 * Which edges (by index in `edges`) a layering reverses to be acyclic. The `declared` ones (a return the author named, `back: true`)
 * are reversed first and the DFS only runs over the rest, so the layers no longer depend on the order the nodes are written in; with
 * none declared it is the plain DFS (from `start`, then the nodes in input order; an edge to a node on the stack is reversed).
 * A declared edge must close a cycle through the other edges, and one cycle takes one declared edge: otherwise it throws.
 */
export declare function breakCycles(nodes: readonly {
    id: string;
}[], edges: readonly LayeredEdge[], declared?: readonly number[], start?: readonly string[]): Set<number>;
/**
 * Layers by longest path after breaking cycles (a DFS back edge is reversed for layering, and drawn from its real tail).
 * Nodes keep input order inside a layer until barycentre sweeps cut crossings; an edge that skips layers goes through a
 * dummy slot per layer so it does not run over the nodes in between. `start` ids (the entry states) are pinned to layer 0.
 */
export declare function layoutLayered(nodes: LayeredNode[], edges: LayeredEdge[], opts?: LayeredOpts & {
    start?: string[];
    back?: readonly number[];
}): LayeredLayout;
