// The numbers behind the seaborn-style distribution charts (boxplot, violinplot, stripplot, swarmplot, pointplot, barplot): pure functions
// of the values they are given. Nothing here is random — a jitter or a bootstrap would make the same data draw a different figure each time.

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
export const meanOf = (xs: readonly number[]): number => sum(xs) / xs.length;
/** The sample standard deviation (n - 1); 0 for a single value. */
export const sdOf = (xs: readonly number[]): number => {
  if (xs.length < 2) return 0;
  const m = meanOf(xs);
  return Math.sqrt(sum(xs.map(x => (x - m) ** 2)) / (xs.length - 1));
};

/** The p-quantile of sorted values by linear interpolation (numpy's default, "type 7"). */
export function quantile(sorted: readonly number[], p: number): number {
  const h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export interface BoxStats {n: number; min: number; max: number; q1: number; median: number; q3: number; /** The ends of the whiskers: the most extreme values within 1.5 IQR of the box. */ lo: number; hi: number; fliers: number[]}
export function boxStats(values: readonly number[]): BoxStats {
  const s = [...values].sort((a, b) => a - b), q1 = quantile(s, 0.25), median = quantile(s, 0.5), q3 = quantile(s, 0.75), iqr = q3 - q1;
  const inside = s.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
  return {n: s.length, min: s[0], max: s[s.length - 1], q1, median, q3, lo: inside[0], hi: inside[inside.length - 1], fliers: s.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr)};
}

// two-sided 95% critical values of Student's t for 1..30 degrees of freedom
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export function tCritical95(df: number): number {
  if (df < 1) return NaN;
  if (df <= 30) return T95[df - 1];
  const z = 1.959964; // Cornish-Fisher expansion about the normal quantile (error < 0.001 beyond 30 degrees of freedom)
  return z + (z ** 3 + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df);
}

export type ErrorKind = 'ci' | 'sd' | 'se' | 'range' | 'none';
/** The error bar of a mean: the 95% confidence interval (t distribution), ±1 standard deviation, ±1 standard error, or the full range. Undefined when n = 1 (nothing to say about spread). */
export function errorBar(values: readonly number[], kind: ErrorKind): [number, number] | undefined {
  const n = values.length, m = meanOf(values);
  if (kind === 'none') return undefined;
  if (kind === 'range') return n < 2 ? undefined : [Math.min(...values), Math.max(...values)];
  if (n < 2) return undefined;
  const sd = sdOf(values), half = kind === 'sd' ? sd : kind === 'se' ? sd / Math.sqrt(n) : tCritical95(n - 1) * sd / Math.sqrt(n);
  return [m - half, m + half];
}

/** Gaussian kernel density estimate at each of `grid`, with Scott's bandwidth (the standard deviation times n^(-1/5): what seaborn uses). Integrates to 1. */
export function kde(values: readonly number[], grid: readonly number[], bwScale = 1): {density: number[]; bw: number} {
  const n = values.length, bw = Math.max(sdOf(values) * n ** -0.2 * bwScale, 1e-12);
  const k = 1 / (n * bw * Math.sqrt(2 * Math.PI));
  return {bw, density: grid.map(g => k * sum(values.map(v => Math.exp(-0.5 * ((g - v) / bw) ** 2))))};
}

/**
 * A beeswarm: each value gets a sideways offset (px) so that no two points of diameter `d` touch, as near the centre line as it can be.
 * `at` are the positions along the value axis (px). Returns the offsets in the order of `at`, or undefined when a point would need
 * to go further than `maxOff` from the centre.
 */
export function swarmOffsets(at: readonly number[], d: number, maxOff: number): number[] | undefined {
  const order = at.map((_v, i) => i).sort((a, b) => at[a] - at[b]), placed: {u: number; off: number}[] = [], out = new Array<number>(at.length).fill(0);
  for (const i of order) {
    const u = at[i], near = placed.filter(p => Math.abs(p.u - u) < d);
    const cands = [0, ...near.flatMap(p => { const dx = Math.sqrt(d * d - (p.u - u) ** 2); return [p.off + dx, p.off - dx]; })].sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
    const off = cands.find(x => near.every(p => Math.hypot(p.u - u, p.off - x) >= d - 1e-6));
    if (off === undefined || Math.abs(off) > maxOff) return undefined;
    placed.push({u, off});
    out[i] = off;
  }
  return out;
}

/** Counts of `values` in the classes between `edges` (a value on an edge belongs to the class above it, the largest value to the last class). */
export function binCounts(values: readonly number[], edges: readonly number[]): number[] {
  const n = edges.length - 1, out = new Array<number>(n).fill(0), w = (edges[n] - edges[0]) / n;
  for (const v of values) out[Math.min(n - 1, Math.max(0, Math.floor((v - edges[0]) / w + 1e-9)))]++;
  return out;
}

/** The index of the class of `edges` that `v` falls in (the same rule as binCounts). */
export function binIndex(v: number, edges: readonly number[]): number {
  const n = edges.length - 1;
  return Math.min(n - 1, Math.max(0, Math.floor((v - edges[0]) / ((edges[n] - edges[0]) / n) + 1e-9)));
}
