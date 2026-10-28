/** A number as it reads on a chart: at most 3 significant digits (12.3, 0.052, 1200). */
export declare const num: (n: number) => string;
/** A number as it is, without float noise (1.2000000000000002 -> 1.2): for data, limits and times, which must be read exactly. */
export declare const exact: (n: number) => string;
/** How many decimals a number needs (0.25 -> 2, 10 -> 0). */
export declare const decimalsOf: (n: number) => number;
export declare const mean: (xs: readonly number[]) => number;
/** The sample standard deviation (n - 1). */
export declare const sd: (xs: readonly number[]) => number;
/** The round step (1, 2, 5 x 10^k) nearest to `raw`. */
export declare function niceNear(raw: number): number;
/** A round step (1, 2, 5 x 10^k) at least as large as `raw`. */
export declare function niceUp(raw: number): number;
export interface ParetoItem {
    label: string;
    value: number;
}
/**
 * The items in descending order of value, the "other" item last whatever its size, and every item beyond `top` folded into it.
 * `vital`: how many of the leading items it takes to reach `reach` percent of the total (the "vital few").
 */
export declare function paretoOrder(items: readonly ParetoItem[], opts?: {
    top?: number;
    other?: string;
    reach?: number;
}): {
    items: ParetoItem[];
    vital: number;
};
export interface HistogramBins {
    /** The class boundaries, bins + 1 of them. */
    edges: number[];
    counts: number[];
    width: number;
}
export declare function histogramBins(values: readonly number[], opts?: {
    bins?: number;
    width?: number;
    include?: readonly number[];
}): HistogramBins;
/** The height of the normal curve (the same mean / sd as the data) at x, as a count per class: n * width * pdf. */
export declare const normalCount: (x: number, m: number, s: number, n: number, width: number) => number;
/** Cp / Cpk of a sample against its specification limits (either may be missing; then only the one-sided index is given). */
export declare function capability(values: readonly number[], lsl?: number, usl?: number): {
    cp?: number;
    cpk?: number;
};
export interface ArrowActivity {
    /** The event it starts at (a number, or any text). */
    from: number | string;
    /** The event it ends at. */
    to: number | string;
    /** What is done (a dummy has none). */
    name?: string;
    /** How long it takes (a dummy: 0, or omitted). */
    days?: number;
    /** A dummy activity: only an order ("this one has to be done before that one"), drawn dashed, no time. */
    dummy?: boolean;
}
export interface ArrowEvent {
    id: string; /** earliest time the event can happen */
    early: number; /** latest time it can happen without delaying the end */
    late: number;
}
export interface ArrowResult {
    events: ArrowEvent[];
    /** The activities as given, each with its float (余裕: how long it can slip without delaying the end) and whether it is on the critical path (float 0). */
    activities: {
        from: string;
        to: string;
        name?: string;
        days: number;
        dummy: boolean;
        float: number;
        critical: boolean;
    }[];
    /** The length of the whole project. */
    length: number;
    /** The names of the activities of one critical path, in order (dummies left out). */
    path: string[];
}
/** The earliest and latest time of every event, the float of every activity and the critical path, of a network drawn with arrows as activities (the PERT / CPM arithmetic). */
export declare function criticalPath(input: readonly ArrowActivity[]): ArrowResult;
