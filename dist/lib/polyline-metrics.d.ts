export interface P {
    x: number;
    y: number;
}
/** Drops repeated points and the middle point of three on a line, so a polyline has only its corners. */
export declare function simplify<T extends P>(pts: T[]): T[];
/** The bends of a polyline: the inner points where the line turns (a repeated point or a point in the middle of a straight run is not one). */
export declare const bendsOf: (points: P[]) => number;
/** The length of a polyline. */
export declare function totalLength(points: P[]): number;
export interface CrossOpts {
    /** How far inside the other segment's span a crossing has to be to count (default 0: strictly inside). */
    margin?: number;
    /** A segment this close to level (or plumb) counts as horizontal (or vertical). Default 0: exactly level or plumb. */
    tol?: number;
}
/**
 * The places where two different polylines properly cross at a right angle: a horizontal run against a vertical one. Touching and
 * overlapping do not count, nor does a polyline crossing itself. Diagonal segments are not counted.
 */
export declare function crossingsOf(paths: P[][], o?: CrossOpts): number;
/** A polyline's level and plumb runs, as `crossingsWith` reads them (worked out once for a polyline that is compared with many). */
export interface Runs {
    h: {
        at: number;
        lo: number;
        hi: number;
    }[];
    v: {
        at: number;
        lo: number;
        hi: number;
    }[];
}
export declare function runsOfPath(p: P[], o?: CrossOpts): Runs;
/** The crossings of two polylines from their runs (what `crossingsWith(a, [b])` counts). */
export declare function crossingsOfRuns(a: Runs, b: Runs, o?: CrossOpts): number;
/** The crossings of one polyline with each of the others (the same count as `crossingsOf`, for a figure in which only this one changed). Only its own pairs are compared: the others are not counted against each other. */
export declare function crossingsWith(path: P[], others: readonly P[][], o?: CrossOpts, cache?: WeakMap<P[], Runs>): number;
/**
 * `scoreOf(next)`, from the score of `prev` and the routes that differ: a local search tries one change after another, and a change moves a few
 * routes, so counting every pair of routes again for each try is most of its cost. The same numbers as counting afresh (test/polyline-metrics.test.ts).
 */
export declare function rescore<K>(prev: ReadonlyMap<K, P[]>, prevScore: {
    crossings: number;
    bends: number;
}, next: ReadonlyMap<K, P[]>, cache?: WeakMap<P[], Runs>): {
    crossings: number;
    bends: number;
};
/** The candidate score of routed arrows: crossings and bends (lower is better; compared crossings first). */
export declare const scoreOf: (paths: P[][]) => {
    crossings: number;
    bends: number;
};
/** Two runs of arrows side by side (under 4px apart, over 4px long together): they read as one line. Shared by the verifier (`cause-parallel`) and the router (ADR 0016 D11). */
export declare function runsTogether(a: {
    p: P;
    q: P;
}, b: {
    p: P;
    q: P;
}): boolean;
/** One pair of side-by-side runs (`parallelRuns`): the routes by index, how far apart the runs are and how long they go together. */
export interface ParallelRun {
    a: number;
    b: number;
    gap: number;
    overlap: number;
}
/**
 * The runs of two different routes on one axis (level with level, plumb with plumb; either direction) that are under `sep` apart and
 * over 4px long together (ADR 0070 D2). Routes that share an end count too. Each route's corners are taken first (`simplify`), so a
 * straight run is one run however many points it has; a slanted segment is not a run. `runsTogether` is the case `sep = 4` for two
 * single runs, and keeps its own definition (the verifier's `cause-parallel` and the router's ADR 0016 D11 read it).
 */
export declare function parallelRuns(routes: readonly P[][], sep: number): ParallelRun[];
/** One run of a route (`parallelRuns`): level or plumb, where it lies across, and its span. */
export interface RouteRun {
    level: boolean;
    at: number;
    lo: number;
    hi: number;
}
/** A route's runs, its corners first (`simplify`): a straight run is one however many points it has; a point and a slanted segment are not runs. */
export declare function runsOfRoute(pts: P[]): RouteRun[];
/**
 * The ways two routes lie against each other (ADR 0070 U4c): how many pairs of runs, one of each, both level (`level`) or both plumb (`plumb`), are side by
 * side (on one axis under `sep` apart, over 4px long together: `parallelRuns`' pair) or on one line with their ends under `sep` apart (a pair `parallelRuns`
 * leaves out: two runs that read as one, ADR 0070 U4b's `touch`).
 */
export declare function runPairWays(a: readonly RouteRun[], b: readonly RouteRun[], sep: number): {
    level: number;
    plumb: number;
};
/** The run pairs of a figure (ADR 0073 D2): `runPairWays` summed over every two routes, at one `sep` (the lane step of the figure), and the overlaps under 4px once more (`parallelRuns(routes, 4)`). `pairs >= parallelRuns(routes, sep).length`: it also counts the pairs on one line. */
export declare function pairsOf(routes: readonly P[][], sep: number): number;
/** A route's runs with the box it lies in (a pair of runs under `sep` apart needs the two boxes within `sep` of each other). */
export interface RoutedRuns {
    pts: P[];
    runs?: RouteRun[];
    x0: number;
    x1: number;
    y0: number;
    y1: number;
}
/** The box of a route, worked out once per array in `cache` (the caller's, so no module holds state); its runs are worked out when they are first asked for (`runsIn`). */
export declare function routedRuns(r: P[], cache: WeakMap<P[], RoutedRuns>): RoutedRuns;
/**
 * How many pairs `next` has against the other routes that `prev` did not (`runPairWays`): the most of the new kinds of pair and the growth of the moved routes' pairs in all (0 or less: none). Only the routes that differ are asked: for each, the other routes
 * it lies against. It does when it lies against a route level or plumb where it did not (the same two routes the other way, a plumb pair for a level
 * one, is a gain too), or when the pairs of the moved routes are more in all than they were. A pair that was there stays allowed (it may be a bit
 * nearer). `cache` holds the runs of the routes by their arrays.
 */
export declare function runPairGain<K>(prev: ReadonlyMap<K, P[]>, next: ReadonlyMap<K, P[]>, sep: number, cache: WeakMap<P[], RoutedRuns>): number;
/** Does `next` lie against the other routes in a way `prev` did not (`runPairGain` over 0)? */
export declare function gainsRunPairs<K>(prev: ReadonlyMap<K, P[]>, next: ReadonlyMap<K, P[]>, sep: number, cache: WeakMap<P[], RoutedRuns>): boolean;
