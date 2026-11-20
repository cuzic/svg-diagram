export declare const sum: (xs: readonly number[]) => number;
export declare const meanOf: (xs: readonly number[]) => number;
/** The sample standard deviation (n - 1); 0 for a single value. */
export declare const sdOf: (xs: readonly number[]) => number;
/** The p-quantile of sorted values by linear interpolation (numpy's default, "type 7"). */
export declare function quantile(sorted: readonly number[], p: number): number;
export interface BoxStats {
    n: number;
    min: number;
    max: number;
    q1: number;
    median: number;
    q3: number; /** The ends of the whiskers: the most extreme values within 1.5 IQR of the box. */
    lo: number;
    hi: number;
    fliers: number[];
}
export declare function boxStats(values: readonly number[]): BoxStats;
export declare function tCritical95(df: number): number;
export type ErrorKind = 'ci' | 'sd' | 'se' | 'range' | 'none';
/** The error bar of a mean: the 95% confidence interval (t distribution), ±1 standard deviation, ±1 standard error, or the full range. Undefined when n = 1 (nothing to say about spread). */
export declare function errorBar(values: readonly number[], kind: ErrorKind): [number, number] | undefined;
/** Gaussian kernel density estimate at each of `grid`, with Scott's bandwidth (the standard deviation times n^(-1/5): what seaborn uses). Integrates to 1. */
export declare function kde(values: readonly number[], grid: readonly number[], bwScale?: number): {
    density: number[];
    bw: number;
};
/**
 * A beeswarm: each value gets a sideways offset (px) so that no two points of diameter `d` touch, as near the centre line as it can be.
 * `at` are the positions along the value axis (px). Returns the offsets in the order of `at`, or undefined when a point would need
 * to go further than `maxOff` from the centre.
 */
export declare function swarmOffsets(at: readonly number[], d: number, maxOff: number): number[] | undefined;
/** Counts of `values` in the classes between `edges` (a value on an edge belongs to the class above it, the largest value to the last class). */
export declare function binCounts(values: readonly number[], edges: readonly number[]): number[];
/** The index of the class of `edges` that `v` falls in (the same rule as binCounts). */
export declare function binIndex(v: number, edges: readonly number[]): number;
export interface PolyFit {
    order: number;
    coef: number[];
    r2: number;
    n: number; /** The fitted value at x. */
    at: (x: number) => number; /** The half-width of the confidence band of the mean at x (undefined without degrees of freedom to spare). */
    half?: (x: number) => number;
    rss: number;
}
/**
 * A least-squares polynomial of `order` 1..3 (the x values are centred and scaled first, so a high order stays well conditioned) with the
 * analytic 95% confidence band of the fitted mean: t(n - p) * s * sqrt(v' (X'X)^-1 v).
 */
export declare function polyFit(xs: readonly number[], ys: readonly number[], order: number): PolyFit;
/**
 * A 2-D Gaussian kernel density estimate on the grid gx × gy (z[j][i] is at gx[i], gy[j]); each axis has Scott's bandwidth for two dimensions
 * (the standard deviation times n^(-1/6)).
 */
export declare function kde2d(xs: readonly number[], ys: readonly number[], gx: readonly number[], gy: readonly number[]): {
    z: number[][];
    bwx: number;
    bwy: number;
};
export interface Merge {
    a: number;
    b: number;
    height: number;
    size: number;
}
/**
 * Agglomerative clustering with average linkage (UPGMA) on the Euclidean distances between the rows of `data`. Leaves are 0..n-1, the k-th merge
 * makes node n + k. Ties go to the pair with the smaller indices, so the same data always gives the same tree.
 */
export declare function averageLinkage(data: readonly (readonly number[])[]): Merge[];
/** The leaves of a tree from averageLinkage in dendrogram order (the child holding the smaller leaf first), and where each node sits (the mean of its children's positions). */
export declare function dendrogramOrder(merges: readonly Merge[], n: number): {
    order: number[];
    pos: number[];
};
/**
 * LOWESS (locally weighted linear regression, Cleveland 1979) as a function of x: at x0 the nearest `frac` of the points are fitted by a
 * weighted line (tricube weights), and `iterations` rounds of bisquare weights on the residuals make it robust to outliers (statsmodels'
 * defaults: frac 2/3, 3 iterations). Evaluated at any x, so a smooth curve can be drawn without interpolating between data points.
 */
export declare function lowessFit(xs: readonly number[], ys: readonly number[], frac?: number, iterations?: number): (x0: number) => number;
