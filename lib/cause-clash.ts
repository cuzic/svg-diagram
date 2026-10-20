import {runsTogether} from './polyline-metrics.ts';
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
/** The pairs of arrows into an effect with an AND that cross or run together (each pair once, in the order the verifier reported them). A crossing elsewhere is left alone. */
export function andClashes<E extends ClashEdge>(edges: readonly E[], ands: readonly {to: string}[]): {a: E; b: E; how: 'crosses' | 'runs together with'}[] {
  const andTo = new Set(ands.map(x => x.to));
  const segs: Seg[] = edges.flatMap((e, k) => andTo.has(e.to) ? e.points.slice(1).flatMap((q, m) => { const p = e.points[m]; return p ? [{k, p, q}] : []; }) : []);
  const out: {a: E; b: E; how: 'crosses' | 'runs together with'}[] = [], flagged = new Set<string>();
  for (const [i, si] of segs.entries()) for (const sj of segs.slice(i + 1)) {
    const a = edges[si.k], b = edges[sj.k];
    if (!a || !b || si.k === sj.k || a.to !== b.to) continue;
    const how = cross(si, sj) ? 'crosses' : runsTogether(si, sj) ? 'runs together with' : undefined;
    const key = `${Math.min(si.k, sj.k)}:${Math.max(si.k, sj.k)}`;
    if (!how || flagged.has(key)) continue;
    flagged.add(key);
    out.push({a, b, how});
  }
  return out;
}
