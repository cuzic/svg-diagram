import type {ChartGeom, LaidOutChartPart} from './charts-base.ts';
import {textWidth} from './atoms.ts';
import {analyzeCausalLoops} from './semnet-analysis.ts';
import type {CausalLink, CausalLoop} from './semnet-analysis.ts';
import {arrow, direction, edgeMid, networkCanvas, nodeBox, pathOf, validateNodes} from './semnet.ts';
import type {CausalNode, CausalOpts, SemnetDirection} from './semnet.ts';

export interface CausalSpec {nodes: CausalNode[]; links: CausalLink[]; loops: CausalLoop[]; direction: SemnetDirection}
export function resolveCausal(nodes: readonly CausalNode[], links: readonly CausalLink[], opts: CausalOpts = {}): CausalSpec {
  validateNodes('causalLoop', nodes, opts.id);
  const loops = analyzeCausalLoops(nodes.map(n => n.id), links);
  return {nodes: nodes.map(n => ({...n})), links: links.map(e => ({...e})), loops, direction: direction('causalLoop', opts.direction)};
}
/** R1, R2, B1, ...: loops are numbered within their kind. */
const loopNames = (loops: readonly CausalLoop[]): string[] => { const n = {R: 0, B: 0}; return loops.map(l => `${l.kind}${++n[l.kind]}`); };
export const causalAlt = (s: CausalSpec): string => { const names = loopNames(s.loops); return `Causal loop diagram. ${s.loops.map((l, i) => `${names[i]}: ${l.nodes.join(' → ')}`).join('; ') || 'No loops.'}`; };
export const causalTexts = (s: CausalSpec): [string, number][] => [...s.nodes.map(n => [n.label, 700] as [string, number]), ...s.links.flatMap(e => [[e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity, 700] as [string, number], ...(e.delay ? [['||', 700] as [string, number]] : []), ...(e.label ? [[e.label, 400] as [string, number]] : [])]), ...loopNames(s.loops).map(n => [n, 700] as [string, number])];

export function layoutCausal(s: CausalSpec, g: ChartGeom): LaidOutChartPart {
  const ns = s.nodes.map(n => ({...n, w: Math.max(116, textWidth(g.widthOf, n.label, g.size, 700) + 28), h: 48})), {c, positions, paths} = networkCanvas(g, ns, s.links, s.direction, 28);
  s.links.forEach((e, i) => {
    const p = pathOf(paths, i, e, positions); arrow(c, p, {stroke: 'text', dash: undefined});
    const m = edgeMid(p), sign = e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity;
    c.place(sign, [{x: m.x, y: m.y - 6, anchor: 'middle'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 12, y: m.y - 6, anchor: 'start'}], sign === '-' ? 'danger' : 'accent', {bold: true, plate: true});
    if (e.delay) c.place('||', [{x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 14, y: m.y + g.size + 8, anchor: 'start'}], 'muted', {bold: true, plate: true});
    if (e.label) c.place(e.label, [{x: m.x + 12, y: m.y - 6, anchor: 'start'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}], 'text', {plate: true});
  });
  for (const n of s.nodes) { const p = positions.get(n.id)!, host = nodeBox(c, p, n.id, n.label, 'text'); c.text(n.label, p.x + p.w / 2, c.mid(p.y + p.h / 2), 'middle', 'text', {bold: true, host, of: n.id}); }
  const names = loopNames(s.loops);
  s.loops.forEach((l, i) => {
    const ps = l.nodes.map(id => positions.get(id)!), x = ps.reduce((a, p) => a + p.x + p.w / 2, 0) / ps.length, bottom = Math.max(...ps.map(p => p.y + p.h));
    c.text(names[i], x, Math.min(c.y + c.h - 5, bottom + g.size + 6), 'middle', l.kind === 'R' ? 'accent' : 'danger', {bold: true, plate: true});
  });
  return c.done();
}
