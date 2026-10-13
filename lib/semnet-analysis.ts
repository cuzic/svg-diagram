import {must} from './must.ts';
/** Pure analyses for semantic networks. No layout, fonts or SVG. */

export interface PertTask {id: string; label: string; duration: number; predecessors?: readonly string[]}
export interface PertResult extends PertTask {predecessors: string[]; es: number; ef: number; ls: number; lf: number; slack: number; critical: boolean}
export interface PertAnalysis {tasks: PertResult[]; duration: number; criticalPath: string[]; criticalEdges: {from: string; to: string}[]}

const semnetError = (who: string, message: string): never => { throw new Error(`${who}(): ${message}`); };

export function analyzeCriticalPath(input: readonly PertTask[]): PertAnalysis {
  if (!input.length) semnetError('pert', 'needs at least one task');
  const order = new Map<string, number>(), byId = new Map<string, PertTask>();
  input.forEach((t, i) => {
    if (typeof t.id !== 'string' || !t.id.trim()) semnetError('pert', `tasks[${i}].id must be a non-empty string`);
    if (byId.has(t.id)) semnetError('pert', `duplicate task id "${t.id}"`);
    if (typeof t.label !== 'string' || !t.label.trim()) semnetError('pert', `task "${t.id}"'s label must be a non-empty string`);
    if (typeof t.duration !== 'number' || !Number.isFinite(t.duration) || t.duration < 0) semnetError('pert', `task "${t.id}"'s duration must be a finite number >= 0`);
    order.set(t.id, i); byId.set(t.id, t);
  });
  const pred = new Map<string, string[]>(), succ = new Map<string, string[]>(input.map(t => [t.id, []]));
  for (const t of input) {
    const ps = [...(t.predecessors ?? [])];
    if (new Set(ps).size !== ps.length) semnetError('pert', `task "${t.id}" repeats a predecessor`);
    for (const p of ps) {
      if (!byId.has(p)) semnetError('pert', `task "${t.id}" names unknown predecessor "${p}"`);
      if (p === t.id) semnetError('pert', `cycle detected: ${t.id} -> ${t.id}`);
      must(succ.get(p)).push(t.id);
    }
    pred.set(t.id, ps);
  }
  const indegree = new Map(input.map(t => [t.id, must(pred.get(t.id)).length]));
  const ready = input.filter(t => !indegree.get(t.id)).map(t => t.id), topo: string[] = [];
  while (ready.length) {
    ready.sort((a, b) => must(order.get(a)) - must(order.get(b)));
    const id = must(ready.shift()); topo.push(id);
    for (const n of must(succ.get(id))) { indegree.set(n, must(indegree.get(n)) - 1); if (!indegree.get(n)) ready.push(n); }
  }
  if (topo.length !== input.length) {
    const cyclic = input.map(t => t.id).filter(id => must(indegree.get(id)) > 0);
    semnetError('pert', `cycle detected among tasks: ${cyclic.join(', ')}`);
  }
  const es = new Map<string, number>(), ef = new Map<string, number>();
  for (const id of topo) {
    const start = Math.max(0, ...must(pred.get(id)).map(p => must(ef.get(p))));
    es.set(id, start); ef.set(id, start + must(byId.get(id)).duration);
  }
  const duration = Math.max(...topo.map(id => must(ef.get(id))));
  const lf = new Map<string, number>(), ls = new Map<string, number>();
  for (const id of [...topo].reverse()) {
    const finish = must(succ.get(id)).length ? Math.min(...must(succ.get(id)).map(s => must(ls.get(s)))) : duration;
    lf.set(id, finish); ls.set(id, finish - must(byId.get(id)).duration);
  }
  const tasks = input.map(t => ({...t, predecessors: [...must(pred.get(t.id))], es: must(es.get(t.id)), ef: must(ef.get(t.id)), ls: must(ls.get(t.id)), lf: must(lf.get(t.id)), slack: must(ls.get(t.id)) - must(es.get(t.id)), critical: Math.abs(must(ls.get(t.id)) - must(es.get(t.id))) < 1e-9}));
  const criticalEdges = tasks.flatMap(t => t.predecessors.filter(p => must(tasks.find(x => x.id === p)).critical && t.critical && Math.abs(must(ef.get(p)) - must(es.get(t.id))) < 1e-9).map(p => ({from: p, to: t.id})));
  // One deterministic representative path; criticalEdges still records parallel/tied paths.
  const criticalPath: string[] = [];
  let current = tasks.find(t => t.critical && t.es === 0)?.id;
  while (current) {
    criticalPath.push(current);
    current = criticalEdges.filter(e => e.from === current).sort((a, b) => must(order.get(a.to)) - must(order.get(b.to)))[0]?.to;
  }
  return {tasks, duration, criticalPath, criticalEdges};
}

export type CausalPolarity = '+' | '-' | 'same' | 'opposite';
export interface CausalLink {from: string; to: string; polarity: CausalPolarity; delay?: boolean; label?: string}
export interface CausalLoop {nodes: string[]; linkIndexes: number[]; negativeLinks: number; kind: 'R' | 'B'}

/** All directed simple cycles, once each, ordered by node input order. */
export function analyzeCausalLoops(nodes: readonly string[], links: readonly CausalLink[]): CausalLoop[] {
  const index = new Map<string, number>();
  nodes.forEach((id, i) => { if (!id || index.has(id)) semnetError('causalLoop', `node ids must be non-empty and unique (got "${id}")`); index.set(id, i); });
  const out = new Map(nodes.map(id => [id, [] as {to: string; edge: number}[]]));
  links.forEach((e, i) => {
    if (!index.has(e.from) || !index.has(e.to)) semnetError('causalLoop', `link ${e.from} -> ${e.to} names unknown node`);
    if (!['+', '-', 'same', 'opposite'].includes(e.polarity)) semnetError('causalLoop', `link ${e.from} -> ${e.to} has invalid polarity "${String(e.polarity)}"`);
    must(out.get(e.from)).push({to: e.to, edge: i});
  });
  const cycles: CausalLoop[] = [];
  nodes.forEach((start, si) => {
    const path = [start], edges: number[] = [], seen = new Set([start]);
    const visit = (at: string): void => {
      for (const e of must(out.get(at))) {
        if (e.to === start) {
          const linkIndexes = [...edges, e.edge], negativeLinks = linkIndexes.filter(i => ['-', 'opposite'].includes(must(links[i]).polarity)).length;
          cycles.push({nodes: [...path], linkIndexes, negativeLinks, kind: negativeLinks % 2 ? 'B' : 'R'});
        } else if (!seen.has(e.to) && must(index.get(e.to)) >= si) {
          seen.add(e.to); path.push(e.to); edges.push(e.edge); visit(e.to); edges.pop(); path.pop(); seen.delete(e.to);
        }
      }
    };
    visit(start);
  });
  return cycles;
}
