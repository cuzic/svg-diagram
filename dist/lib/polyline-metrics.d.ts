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
/** The crossings of one polyline with each of the others (the same count as `crossingsOf`, for a figure in which only this one changed). */
export declare function crossingsWith(path: P[], others: readonly P[][], o?: CrossOpts): number;
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
