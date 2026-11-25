/** A link as the count sees it: only the ends matter. `back` (a declared feedback arrow) and `kind: 'blocks'` (a cutting arrow)
 *  cause nothing, so they are not walked. */
export interface ReachLink {
    from: string | readonly string[];
    to: string;
    back?: boolean;
    kind?: string;
}
/**
 * For every starting node (no arrow enters it), how many `ude` nodes its arrows reach, directly or through other nodes (itself not
 * counted). An AND counts as arrows from each of its causes: every member reaches the effect. A cycle is walked once.
 */
export declare function reachCounts(nodes: readonly {
    id: string;
    role?: string;
}[], links: readonly ReachLink[]): Map<string, number>;
/** The core drivers: the starting nodes with the most reach, when that is 2 or more (a tie: all of them). */
export declare function coreDrivers(counts: ReadonlyMap<string, number>): string[];
