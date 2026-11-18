import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutTree, TreeNodeText } from '../types/diagrams.ts';
import type { WrappedRun } from '../types/text-bands.ts';
import type { Fonts, Rect } from './xml.ts';
import type { ToneEnv } from '../tokens.ts';
type Node = LaidOutTree['nodes'][number];
/** A node's lines as runs: consecutive lines of the same size, weight and colour are one run, at the baselines the layout gave. */
export declare function nodeRunsOf(n: Rect & {
    tone: Node['tone'];
}, texts: readonly TreeNodeText[], tones: ToneEnv): WrappedRun[];
export interface TreeShapes {
    xml: string;
    glue: {
        dslId: string;
        id: number;
        rect: Rect;
    }[];
}
/**
 * The branches of a tree (ADR 0054 D9.3): each node that has children is a branch, its path the branches above it; the root's branch is
 * the band's own group, a leaf is no branch of its own, and a subtree that holds a band node (no box: it is drawn as a band of its own)
 * is not a branch. Returns each node's path (outside in) and whether it has a branch of its own.
 */
export declare function treeBranches(b: Pick<LaidOutTree, 'nodes'>, label: (i: number) => string): {
    path: string[];
    own: boolean;
}[];
/** The tree's shapes, numbered from `next`. Lines, then braces, then nodes (as the svg draws them); each branch a group (treeBranches). */
export declare function treeXml(b: LaidOutTree, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): TreeShapes;
export {};
