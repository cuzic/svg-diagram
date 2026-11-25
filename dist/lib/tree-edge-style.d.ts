import type { ToneEnv } from './tokens.ts';
import type { TagTone, Theme } from './types/core.ts';
import type { LaidOutTree, TreeItem } from './types/diagrams.ts';
export type EdgeLine = 'solid' | 'dashed' | 'dotted';
export interface EdgeStyle {
    tone: TagTone;
    line: EdgeLine;
}
type LaidOutEdge = LaidOutTree['edges'][number];
export declare const DEFAULT_EDGE: EdgeStyle;
export declare const sameEdge: (a: EdgeStyle, b: EdgeStyle) => boolean;
export declare const isDefaultEdge: (s: EdgeStyle) => boolean;
/** The written `edge` of an item with its defaults filled in (`undefined`, `{}` and `{tone: 'muted', line: 'solid'}` are the same). */
export declare const normalizeEdge: (item: TreeItem) => EdgeStyle;
/** Whether any item of the tree asks for a line that is not the default (then the private segment of each line is widened to 24px). */
export declare const hasStyledEdge: (items: readonly TreeItem[]) => boolean;
export interface Stroke {
    color: string;
    line: EdgeLine;
}
/**
 * The strokes of one line: `trunk` for the part its siblings share, `own` for the part that is the item's alone. A `focus` lit line is accent
 * (the trunk a solid accent so the way to the root stays whole), a dimmed tree (`spotlight`) is muted; both keep the item's line kind (ADR 0081 table).
 * The line is one path when the two are the same.
 */
export declare function edgeStrokes(e: LaidOutEdge, dim: boolean | undefined, day: Theme, tones: ToneEnv): {
    own: Stroke;
    trunk: Stroke;
};
export declare const isOnePath: (own: Stroke, trunk: Stroke) => boolean;
export declare const compareEdgeOrder: (p: LaidOutEdge, q: LaidOutEdge) => number;
/**
 * Decides `style` (S, the item's own last segment) and `trunk` (T, the part siblings share) of each line (ADR 0081 D2). A group is the lines of one parent
 * that leave from the same first point; a two-point line and a funnel (`from`) line share nothing and belong to no group.
 * `focused`: a line that is not lit is muted (its `edge.tone` is not used) with a solid trunk.
 */
export declare function assignEdgeStyles(edges: LaidOutEdge[], itemOf: (e: LaidOutEdge) => TreeItem | undefined, focused: boolean): void;
export {};
