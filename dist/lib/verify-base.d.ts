import type { Rect } from './types/core.ts';
export declare const CONTRAST_THRESHOLD = 70;
/**
 * Returns the overlap {dx,dy} if two rects share more than `tolerance`px of area in both axes, else null. Rects that merely
 * touch at a shared edge (adjacent row children, a box and the row's own bounding rect) are not overlaps.
 */
export declare function rectOverlap(a: Rect, b: Rect, tolerance?: number): {
    dx: number;
    dy: number;
} | null;
export declare function labelOf(band: object): string;
export declare const neverTogether: (a: {
    reveal?: number;
    until?: number;
}, b: {
    reveal?: number;
    until?: number;
}) => boolean;
type Pt = {
    x: number;
    y: number;
};
/** The 1px-padded box of one straight run of a route. */
export declare const segBox: (p: Pt, q: Pt) => Rect;
/** Does any run of the route touch `r`? */
export declare const routeHits: (points: readonly Pt[], r: Rect) => boolean;
/** For each route and each node it does not start or end at: the first run that touches the node reports once (`say`). */
export declare function routesThroughNodes<E extends {
    from: string;
    to: string;
    points: readonly Pt[];
}, N extends Rect & {
    id: string;
}>(edges: readonly E[], nodes: readonly N[], say: (e: E, n: N) => string): string[];
/** Every pair (earlier, later) of `items` that overlap: `report(a, b, overlap)`. */
export declare function eachOverlap<T extends Rect>(items: readonly T[], report: (a: T, b: T, o: {
    dx: number;
    dy: number;
}, i: number, j: number) => void): void;
export declare const dxdy: (o: {
    dx: number;
    dy: number;
}) => string;
/** Past the left or right edge of the figure. */
export declare const outsideX: (r: Rect, fig: Rect) => boolean;
/** Past any edge of the figure. */
export declare const outsideBox: (r: Rect, fig: Rect) => boolean;
/**
 * What the check finds wrong in a laid-out state diagram: a transition through a state it does not touch, a label chip outside the figure, on a state, on another arrow or on another chip.
 * The check (verify-handlers.ts) and the layout (states.ts: `density: 'compact'` falls back to the normal gaps when this finds more) use the same list.
 */
export declare function statesProblems(band: Rect & {
    flavor?: 'flowchart';
    edges: readonly {
        from: string;
        to: string;
        points: readonly Pt[];
    }[];
    anchors: readonly (Rect & {
        id: string;
    })[];
    labels: readonly (Rect & {
        text: string;
        edge: number;
    })[];
}): string[];
export {};
