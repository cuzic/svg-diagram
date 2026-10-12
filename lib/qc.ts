// The numbers behind the QC tools: what pareto(), histogram(), scatter() and controlChart() work out from the data they are given,
// kept apart from drawing so that each can be tested on its own. Nothing here knows about bands or pixels.

/** A number as it reads on a chart: at most 3 significant digits (12.3, 0.052, 1200). */
export const num = (n: number): string => String(parseFloat(n.toPrecision(3)));

export const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
/** The sample standard deviation (n - 1). */
export const sd = (xs: readonly number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

/** The round step (1, 2, 5 x 10^k) nearest to `raw`. */
export function niceNear(raw: number): number {
  if (!(raw > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  return mag * (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10);
}
/** A round step (1, 2, 5 x 10^k) at least as large as `raw`. */
export function niceUp(raw: number): number {
  if (!(raw > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  return mag * (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
}

// ---- Pareto ------------------------------------------------------------------------------------------------------------------

export interface ParetoItem {label: string; value: number}

/**
 * The items in descending order of value, the "other" item last whatever its size, and every item beyond `top` folded into it.
 * `vital`: how many of the leading items it takes to reach `reach` percent of the total (the "vital few").
 */
export function paretoOrder(items: readonly ParetoItem[], opts: {top?: number; other?: string; reach?: number} = {}): {items: ParetoItem[]; vital: number} {
  const other = opts.other ?? 'その他';
  const named = items.filter(i => i.label !== other).sort((a, b) => b.value - a.value);
  let tail = items.filter(i => i.label === other).reduce((n, i) => n + i.value, 0);
  let head = named;
  if (opts.top !== undefined && named.length > opts.top) {
    tail += named.slice(opts.top).reduce((n, i) => n + i.value, 0);
    head = named.slice(0, opts.top);
  }
  const ordered = tail > 0 ? [...head, {label: other, value: tail}] : head;
  const total = ordered.reduce((n, i) => n + i.value, 0), reach = opts.reach ?? 80;
  let run = 0, vital = 0;
  for (const i of head) { vital++; run += i.value; if (run / total * 100 >= reach - 1e-9) break; }
  return {items: ordered, vital: Math.min(vital, head.length)};
}

// ---- histogram ---------------------------------------------------------------------------------------------------------------

export interface HistogramBins {
  /** The class boundaries, bins + 1 of them. */
  edges: number[];
  counts: number[];
  width: number;
}

/**
 * Class boundaries and counts. The width is a round number (1, 2, 5 x 10^k) that gives about `bins` classes (Sturges' rule when not
 * given); the first boundary is a multiple of the width at or below the smallest value (or `include`d position). A value on a boundary
 * belongs to the class above it, the largest value to the last class.
 */
export function histogramBins(values: readonly number[], opts: {bins?: number; width?: number; include?: readonly number[]} = {}): HistogramBins {
  const lo = Math.min(...values, ...opts.include ?? []), hi = Math.max(...values, ...opts.include ?? []);
  const want = opts.bins ?? Math.ceil(Math.log2(values.length)) + 1;
  const width = opts.width ?? niceNear((hi - lo || Math.abs(hi) || 1) / want);
  const start = Math.floor(lo / width + 1e-9) * width;
  let n = Math.max(1, Math.ceil((hi - start) / width - 1e-9));
  if (start + n * width <= hi - 1e-9) n++;
  const edges = Array.from({length: n + 1}, (_, i) => parseFloat((start + i * width).toPrecision(12)));
  const counts = new Array<number>(n).fill(0);
  for (const v of values) counts[Math.min(n - 1, Math.max(0, Math.floor((v - start) / width + 1e-9)))]++;
  return {edges, counts, width};
}

/** The height of the normal curve (the same mean / sd as the data) at x, as a count per class: n * width * pdf. */
export const normalCount = (x: number, m: number, s: number, n: number, width: number): number => s > 0 ? n * width * Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)) : 0;

// ---- process capability ------------------------------------------------------------------------------------------------------

/** Cp / Cpk of a sample against its specification limits (either may be missing; then only the one-sided index is given). */
export function capability(values: readonly number[], lsl?: number, usl?: number): {cp?: number; cpk?: number} {
  const m = mean(values), s = sd(values);
  if (!(s > 0)) return {};
  const cp = lsl !== undefined && usl !== undefined ? (usl - lsl) / (6 * s) : undefined;
  const ups = usl !== undefined ? (usl - m) / (3 * s) : undefined, lows = lsl !== undefined ? (m - lsl) / (3 * s) : undefined;
  const cpk = ups !== undefined && lows !== undefined ? Math.min(ups, lows) : ups ?? lows;
  return {...(cp === undefined ? {} : {cp}), ...(cpk === undefined ? {} : {cpk})};
}
