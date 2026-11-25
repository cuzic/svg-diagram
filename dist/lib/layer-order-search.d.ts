/** One search: the rows found, how many layer crossings (weight 1) they have, the weighted cost, and how many annealing moves were tried (a measure of cost that does not depend on the machine). */
export interface RowSearchResult {
    rows: string[][];
    plainCrossings: number;
    cost: number;
    moves: number;
}
/** The crossings between neighbouring layers of `rows`: weighted (AND links count AND_WEIGHT) or plain. Used by the tests to check the cost the search tracked move by move. */
export declare function layerCrossings(rows: readonly (readonly string[])[], succ: ReadonlyMap<string, readonly string[]>, andTo: ReadonlySet<string>, plain: boolean): number;
/**
 * ADR 0075 D1. `rows` are the rows the sweeps left; `succ` the links (from the lower layer to the next one); `comp` the connected component of a node (a swap never crosses one); `andTo` the AND effects.
 * Deterministic: one linear congruential stream (seed 7) is shared by every restart and row.
 */
export declare function searchLayerRows(rows: readonly (readonly string[])[], succ: ReadonlyMap<string, readonly string[]>, comp: (id: string) => number, andTo: ReadonlySet<string>): RowSearchResult;
