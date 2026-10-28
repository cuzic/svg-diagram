/** Every ordering of `a` (the first element varies slowest, so the original order comes first). */
export declare function permutations<T>(a: T[]): T[][];
/** The total distance between the lanes of each pair, when the lanes are laid out in `order` (lane indexes, top to bottom). */
export declare function laneDistance(order: readonly number[], pairs: readonly (readonly [number, number])[]): number;
/** The most lanes whose order is searched: 8! orderings are tried, and the check has always stopped there. */
export declare const MAX_LANES_TO_ORDER = 8;
/**
 * The lane order (lane indexes, top to bottom) with the smallest total distance for `pairs` (each flow's two lane indexes). Lanes in
 * `fixed` keep their place; the others take the places the fixed ones leave. A tie keeps the order the lanes were given in.
 */
export declare function bestLaneOrder(laneCount: number, fixed: ReadonlySet<number>, pairs: readonly (readonly [number, number])[]): number[];
