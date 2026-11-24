import {fail} from './charts-base.ts';
import {must} from './must.ts';
/** Pure analyses for semantic networks. No layout, fonts or SVG. */

export type CausalPolarity = '+' | '-' | 'same' | 'opposite';
export interface CausalLink {from: string; to: string; polarity: CausalPolarity; delay?: boolean; label?: string}
export interface CausalLoop {nodes: string[]; linkIndexes: number[]; negativeLinks: number; kind: 'R' | 'B'}

/** All directed simple cycles, once each, ordered by node input order. */
export function analyzeCausalLoops(nodes: readonly string[], links: readonly CausalLink[]): CausalLoop[] {
  const index = new Map<string, number>();
  nodes.forEach((id, i) => { if (!id || index.has(id)) fail('causalLoop', `node ids must be non-empty and unique (got "${id}")`); index.set(id, i); });
  const out = new Map(nodes.map(id => [id, [] as {to: string; edge: number}[]]));
  links.forEach((e, i) => {
    if (!index.has(e.from) || !index.has(e.to)) fail('causalLoop', `link ${e.from} -> ${e.to} names unknown node`);
    if (!['+', '-', 'same', 'opposite'].includes(e.polarity)) fail('causalLoop', `link ${e.from} -> ${e.to} has invalid polarity "${String(e.polarity)}"`);
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
