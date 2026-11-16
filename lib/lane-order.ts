// The order of swimlane lanes that makes the hand-offs shortest: the sum, over the flows, of the distance between the lanes a flow joins.
// swimlane({laneOrder: 'auto'}) applies it when the figure is built; the check rule `swimlane-lane-order` reports it for a figure that did not.
// Both ask here, so what the rule suggests is what 'auto' does.

/** Every ordering of `a` (the first element varies slowest, so the original order comes first). */
export function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
}

/** The total distance between the lanes of each pair, when the lanes are laid out in `order` (lane indexes, top to bottom). */
export function laneDistance(order: readonly number[], pairs: readonly (readonly [number, number])[]): number {
  const pos = new Map(order.map((lane, i) => [lane, i]));
  return pairs.reduce((s, [a, b]) => s + Math.abs((pos.get(a) ?? 0) - (pos.get(b) ?? 0)), 0);
}

/** The most lanes whose order is searched: 8! orderings are tried, and the check has always stopped there. */
export const MAX_LANES_TO_ORDER = 8;

/**
 * The lane order (lane indexes, top to bottom) with the smallest total distance for `pairs` (each flow's two lane indexes). Lanes in
 * `fixed` keep their place; the others take the places the fixed ones leave. A tie keeps the order the lanes were given in.
 */
export function bestLaneOrder(laneCount: number, fixed: ReadonlySet<number>, pairs: readonly (readonly [number, number])[]): number[] {
  const cur = [...Array(laneCount).keys()];
  const free = cur.filter(i => !fixed.has(i));
  let best = cur, bestD = laneDistance(cur, pairs);
  for (const p of permutations(free)) {
    const order = cur.map(i => (fixed.has(i) ? i : (p[free.indexOf(i)] as number)));
    const d = laneDistance(order, pairs);
    if (d < bestD) { best = order; bestD = d; }
  }
  return best;
}
