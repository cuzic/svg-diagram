import type { P } from './polyline-metrics.ts';
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface SearchOpts {
    /** The room kept between a run and a box (also where the runs go: a line this far off each side of a box). */
    margin?: number;
    /** The first run leaves the tail this far before it may turn; the last run is this long before the head. */
    stub?: number;
    tail?: number;
    /** Costs, in length units: a bend, a crossing of another arrow's run, a run along another arrow's. */
    bend?: number;
    cross?: number;
    along?: number;
    /** A run across another arrow's last run this close to its tip (inside its arrowhead and the room for a hop beside it) costs this much: it reads as a join. */
    head?: number;
    /** The most steps of the search (a state's neighbours tried); over it the search gives up (undefined), so the time per arrow is bounded. */
    budget?: number;
}
/** How far before its tip another arrow's last run is kept clear of a crossing: the arrowhead (12) and the bump of a hop (6) beside it, and a margin. */
export declare const HEAD_REACH = 22;
/** The crossings of a run across the layers with the last run of another arrow, within `HEAD_REACH` of its tip: they read as joins, and `hop` skips them. */
export declare function headCrossings(paths: readonly P[][]): number;
/**
 * A polyline from `start` to `end` (both on box sides; the arrow runs toward larger x) that keeps `margin` off every box in `boxes`, stays in `bounds`, and costs least in
 * length, bends, crossings of `others` and runs along them. Undefined when there is none.
 */
export declare function searchRoute(start: P, end: P, boxes: readonly Rect[], others: readonly P[][], bounds: Rect, o?: SearchOpts): P[] | undefined;
