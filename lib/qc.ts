import {must} from './must.ts';
// The numbers behind the QC tools: what pareto(), histogram(), scatter() and controlChart() work out from the data they are given,
// kept apart from drawing so that each can be tested on its own. Nothing here knows about bands or pixels.

/** A number as it reads on a chart: at most 3 significant digits (12.3, 0.052, 1200). */
export const num = (n: number): string => String(parseFloat(n.toPrecision(3)));

/** A number as it is, without float noise (1.2000000000000002 -> 1.2): for data, limits and times, which must be read exactly. */
export const exact = (n: number): string => String(parseFloat(n.toPrecision(12)));
/** How many decimals a number needs (0.25 -> 2, 10 -> 0). */
export const decimalsOf = (n: number): number => { const t = exact(Math.abs(n)); const i = t.indexOf('.'); return i < 0 ? 0 : t.length - i - 1; };

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
const MAX_CLASSES = 60;
export function histogramBins(values: readonly number[], opts: {bins?: number; width?: number; include?: readonly number[]} = {}): HistogramBins {
  const dlo = Math.min(...values), dhi = Math.max(...values);
  const want = opts.bins ?? Math.ceil(Math.log2(values.length)) + 1;
  // the width comes from the data alone; marks (specification limits) only stretch the range the classes cover
  const width = opts.width ?? niceNear((dhi - dlo || Math.abs(dhi) || 1) / want);
  const lo = Math.min(dlo, ...opts.include ?? []), hi = Math.max(dhi, ...opts.include ?? []);
  const start = Math.floor(lo / width + 1e-9) * width;
  let n = Math.max(1, Math.ceil((hi - start) / width - 1e-9));
  if (n > MAX_CLASSES) throw new Error(`histogram(): ${n} classes of width ${exact(width)} (at most ${MAX_CLASSES}): use a wider width, fewer bins, or limits closer to the data`);
  if (start + n * width <= hi - 1e-9) n++;
  const edges = Array.from({length: n + 1}, (_, i) => parseFloat((start + i * width).toPrecision(12)));
  const counts = new Array<number>(n).fill(0);
  for (const v of values) { const k = Math.min(n - 1, Math.max(0, Math.floor((v - start) / width + 1e-9))); counts[k] = must(counts[k]) + 1; }
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

// ---- arrow diagram (critical path) -------------------------------------------------------------------------------------------

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
export interface ArrowEvent {id: string; /** earliest time the event can happen */ early: number; /** latest time it can happen without delaying the end */ late: number}
export interface ArrowResult {
  events: ArrowEvent[];
  /** The activities as given, each with its float (余裕: how long it can slip without delaying the end) and whether it is on the critical path (float 0). */
  activities: {from: string; to: string; name?: string; days: number; dummy: boolean; float: number; critical: boolean}[];
  /** The length of the whole project. */
  length: number;
  /** The names of the activities of one critical path, in order (dummies left out). */
  path: string[];
}

/** The earliest and latest time of every event, the float of every activity and the critical path, of a network drawn with arrows as activities (the PERT / CPM arithmetic). */
export function criticalPath(input: readonly ArrowActivity[]): ArrowResult {
  if (!Array.isArray(input) || input.length === 0) throw new Error('arrowDiagram(activities) needs at least one activity');
  const acts = input.map((a, i) => {
    const from = String(a.from), to = String(a.to), days = a.days ?? 0, dummy = a.dummy === true;
    if (a.from === undefined || a.to === undefined || from === '' || to === '') throw new Error(`arrowDiagram(): activity ${i + 1} needs a from and a to event`);
    if (from === to) throw new Error(`arrowDiagram(): activity ${i + 1} ("${a.name ?? ''}") starts and ends at event ${from}`);
    if (!(Number.isFinite(days) && days >= 0)) throw new Error(`arrowDiagram(): activity ${i + 1} ("${a.name ?? ''}") needs days >= 0 (got ${a.days})`);
    if (!dummy && !a.name?.trim()) throw new Error(`arrowDiagram(): activity ${i + 1} (${from} -> ${to}) needs a name (or dummy: true)`);
    if (dummy && days !== 0) throw new Error(`arrowDiagram(): the dummy ${from} -> ${to} takes no time (days ${days})`);
    return {from, to, name: a.name, days, dummy};
  });
  const seenPair = new Set<string>();
  for (const a of acts) {
    const k = `${a.from}\u0000${a.to}`;
    if (seenPair.has(k)) throw new Error(`arrowDiagram(): two activities run from event ${a.from} to event ${a.to}; give one of them a dummy and a new event, so each pair of events has one arrow`);
    seenPair.add(k);
  }
  const ids = [...new Set(acts.flatMap(a => [a.from, a.to]))];
  const incoming = new Map(ids.map(id => [id, acts.filter(a => a.to === id)])), outgoing = new Map(ids.map(id => [id, acts.filter(a => a.from === id)]));
  const starts = ids.filter(id => !must(incoming.get(id)).length), ends = ids.filter(id => !must(outgoing.get(id)).length);
  if (starts.length !== 1) throw new Error(`arrowDiagram(): there must be exactly one start event, the one nothing leads into (found ${starts.length ? starts.join(', ') : 'none: the arrows go round'})`);
  if (ends.length !== 1) throw new Error(`arrowDiagram(): there must be exactly one end event, the one nothing leaves (found ${ends.length ? ends.join(', ') : 'none'}); join the loose ends with a dummy`);
  // topological order (Kahn); a cycle leaves events behind
  const left = new Map(ids.map(id => [id, must(incoming.get(id)).length])), order: string[] = [];
  const queue = [starts[0]];
  while (queue.length) {
    const id = must(queue.shift());
    order.push(id);
    for (const a of must(outgoing.get(id))) { left.set(a.to, must(left.get(a.to)) - 1); if (left.get(a.to) === 0) queue.push(a.to); }
  }
  if (order.length !== ids.length) throw new Error(`arrowDiagram(): the arrows go round in a circle (events ${ids.filter(id => !order.includes(id)).join(', ')}); an activity cannot wait for itself`);
  const early = new Map<string, number>(), late = new Map<string, number>();
  for (const id of order) early.set(id, Math.max(0, ...must(incoming.get(id)).map(a => must(early.get(a.from)) + a.days)));
  const length = must(early.get(must(ends[0])));
  for (const id of [...order].reverse()) late.set(id, must(outgoing.get(id)).length ? Math.min(...must(outgoing.get(id)).map(a => must(late.get(a.to)) - a.days)) : length);
  const rounded = (v: number) => Math.abs(v) < 1e-9 ? 0 : parseFloat(v.toPrecision(12));
  const activities = acts.map(a => { const float = rounded(must(late.get(a.to)) - must(early.get(a.from)) - a.days); return {...a, float, critical: float < 1e-9}; });
  // one critical path: from the start, always along a critical activity
  const path: string[] = [];
  for (let at = starts[0]; at !== ends[0];) {
    const next = must(activities.find(a => a.from === at && a.critical));
    if (!next.dummy) path.push(must(next.name));
    at = next.to;
  }
  const byId = (a: string, b: string) => { const x = Number(a), y = Number(b); return Number.isFinite(x) && Number.isFinite(y) ? x - y : a.localeCompare(b, 'en'); };
  return {events: ids.sort(byId).map(id => ({id, early: rounded(must(early.get(id))), late: rounded(must(late.get(id)))})), activities, length: rounded(length), path};
}
