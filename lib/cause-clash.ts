// Two arrows into one effect that has an AND must not cross, and must not run side by side (which arrow belongs to the AND would be unclear).
// One definition, used by the verifier (the `cause-crossing` / `cause-parallel` warnings) and by the order search of causeTree (ADR 0019 D4).
interface Seg {k: number; p: {x: number; y: number}; q: {x: number; y: number}}
export interface ClashEdge {from: string; to: string; points: {x: number; y: number}[]}

const cross = (a: Seg, b: Seg): boolean => {
  const aH = a.p.y === a.q.y, bH = b.p.y === b.q.y;
  if (aH === bH) return false;
  const h = aH ? a : b, v = aH ? b : a;
  return v.p.x > Math.min(h.p.x, h.q.x) + 0.5 && v.p.x < Math.max(h.p.x, h.q.x) - 0.5 && h.p.y > Math.min(v.p.y, v.q.y) + 0.5 && h.p.y < Math.max(v.p.y, v.q.y) - 0.5;
};
// runs of two arrows side by side (under 4px apart, over 4px long together) read as one line
const together = (a: Seg, b: Seg): boolean => {
  const aH = a.p.y === a.q.y;
  if (aH !== (b.p.y === b.q.y)) return false;
  const [c, d] = aH ? ['x', 'y'] as const : ['y', 'x'] as const;
  return Math.abs(a.p[d] - b.p[d]) < 4 && Math.min(Math.max(a.p[c], a.q[c]), Math.max(b.p[c], b.q[c])) - Math.max(Math.min(a.p[c], a.q[c]), Math.min(b.p[c], b.q[c])) > 4;
};

/** The pairs of arrows into an effect with an AND that cross or run together (each pair once, in the order the verifier reported them). A crossing elsewhere is left alone. */
export function andClashes<E extends ClashEdge>(edges: readonly E[], ands: readonly {to: string}[]): {a: E; b: E; how: 'crosses' | 'runs together with'}[] {
  const andTo = new Set(ands.map(x => x.to));
  const segs: Seg[] = edges.flatMap((e, k) => andTo.has(e.to) ? e.points.slice(1).map((q, m) => ({k, p: e.points[m], q})) : []);
  const out: {a: E; b: E; how: 'crosses' | 'runs together with'}[] = [], flagged = new Set<string>();
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const a = edges[segs[i].k], b = edges[segs[j].k];
    if (segs[i].k === segs[j].k || a.to !== b.to) continue;
    const how = cross(segs[i], segs[j]) ? 'crosses' : together(segs[i], segs[j]) ? 'runs together with' : undefined;
    const key = `${Math.min(segs[i].k, segs[j].k)}:${Math.max(segs[i].k, segs[j].k)}`;
    if (!how || flagged.has(key)) continue;
    flagged.add(key);
    out.push({a, b, how});
  }
  return out;
}
