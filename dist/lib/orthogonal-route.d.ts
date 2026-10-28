import type { Pt } from './graph-layout.ts';
export interface RouteRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface RouteOpts {
    from: RouteRect;
    to: RouteRect;
    /** every box the route must keep out of (the two ends included) */
    boxes: RouteRect[];
    /** the figure: the route stays inside it */
    bounds: RouteRect;
    /** flows already drawn: crossing one costs a little, riding along one costs a lot */
    others?: Pt[][];
    /** lines the route may turn on besides the boxes' edges (the gaps between columns, the margins of lanes) */
    xs?: number[];
    ys?: number[];
    /** clearance from a box (default 6) and length of the straight run into / out of a box (default 14) */
    margin?: number;
    stub?: number;
}
/** The cheapest route from a side of `from` to a side of `to` that touches no other box, or null when the boxes close every way. */
export declare function routeClear(o: RouteOpts): Pt[] | null;
