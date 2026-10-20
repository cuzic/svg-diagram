// Counting over a cause tree's nodes and links (pure: no layout, no fonts). The core driver of a current reality tree is the root
// cause that, through the arrows, brings about the most undesirable effects (ADR 0015 D4).

/** A link as the count sees it: only the ends matter. `back` (a declared feedback arrow) and `kind: 'blocks'` (a cutting arrow)
 *  cause nothing, so they are not walked. */
export interface ReachLink {from: string | readonly string[]; to: string; back?: boolean; kind?: string}

const walks = (l: ReachLink): boolean => !l.back && l.kind !== 'blocks';

/**
 * For every starting node (no arrow enters it), how many `ude` nodes its arrows reach, directly or through other nodes (itself not
 * counted). An AND counts as arrows from each of its causes: every member reaches the effect. A cycle is walked once.
 */
export function reachCounts(nodes: readonly {id: string; role?: string}[], links: readonly ReachLink[]): Map<string, number> {
  const next = new Map<string, string[]>(), entered = new Set<string>();
  for (const l of links) {
    if (!walks(l)) continue;
    entered.add(l.to);
    for (const f of typeof l.from === 'string' ? [l.from] : l.from) {
      const list = next.get(f) ?? [];
      list.push(l.to);
      next.set(f, list);
    }
  }
  const ude = new Set(nodes.filter(n => n.role === 'ude').map(n => n.id)), out = new Map<string, number>();
  for (const n of nodes) {
    if (entered.has(n.id)) continue;
    const seen = new Set<string>([n.id]), stack = [n.id];
    let count = 0;
    for (let cur = stack.pop(); cur !== undefined; cur = stack.pop()) for (const t of next.get(cur) ?? []) if (!seen.has(t)) { seen.add(t); stack.push(t); if (ude.has(t)) count++; }
    out.set(n.id, count);
  }
  return out;
}

/** The core drivers: the starting nodes with the most reach, when that is 2 or more (a tie: all of them). */
export function coreDrivers(counts: ReadonlyMap<string, number>): string[] {
  const top = Math.max(0, ...counts.values());
  return top < 2 ? [] : [...counts].filter(([, c]) => c === top).map(([id]) => id);
}
