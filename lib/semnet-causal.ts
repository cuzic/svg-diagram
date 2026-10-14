import type {Canvas, Cand, ChartBox, ChartGeom, LaidOutChartPart} from './charts-base.ts';
import {fail} from './charts-base.ts';
import type {Pt} from './graph-layout.ts';
import {textWidth} from './atoms.ts';
import {analyzeCausalLoops} from './semnet-analysis.ts';
import type {CausalLink, CausalLoop} from './semnet-analysis.ts';
import {arrow, direction, edgeMid, networkCanvas, nodeBox, pathOf, placeEdgeLabel, validateNodes} from './semnet.ts';
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
  // Stage 1: every line and every box. Stage 2: the signs and names, over the finished lines (a sign placed between two edges' lines would be struck through by the later one).
  const edges = s.links.map((e, i) => { const p = pathOf(paths, i, e, positions); arrow(c, p, {stroke: 'text', dash: undefined}); return {e, p}; });
  for (const n of s.nodes) { const p = positions.get(n.id)!, host = nodeBox(c, p, n.id, n.label, 'text'); c.text(n.label, p.x + p.w / 2, c.mid(p.y + p.h / 2), 'middle', 'text', {bold: true, host, of: n.id}); }
  for (const {e, p} of edges) placeSign(c, g, e, p);
  placeLoopNames(c, g, s.loops, positions);
  return c.done();
}

type Boxes = Map<string, {x: number; y: number; w: number; h: number}>;
/** The polarity (and delay, and label) of one edge. A polarity that finds no room stops the build: a missing sign would turn R into B. */
function placeSign(c: Canvas, g: ChartGeom, e: CausalLink, p: Pt[]): void {
  const m = edgeMid(p), sign = e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity;
  const need = (what: string, put: ChartBox | undefined): void => { if (!put) fail('causalLoop', `${what} of ${e.from} -> ${e.to} has no room (raise height / width)`); };
  need(`the polarity "${sign}"`, placeEdgeLabel(c, sign, p, [{x: m.x, y: m.y - 6, anchor: 'middle'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 12, y: m.y - 6, anchor: 'start'}], sign === '-' ? 'danger' : 'accent', {bold: true, plate: true}));
  if (e.delay) need('the delay mark "||"', placeEdgeLabel(c, '||', p, [{x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 14, y: m.y + g.size + 8, anchor: 'start'}], 'muted', {bold: true, plate: true}));
  if (e.label) need(`the label "${e.label}"`, placeEdgeLabel(c, e.label, p, [{x: m.x + 12, y: m.y - 6, anchor: 'start'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}], 'text', {plate: true}));
}
/** R1 / B1 under the loop's lowest node; when a sign is already there: above the loop, at its centre, then outwards in 8px steps. Nothing free: where it used to go (the check reports it). */
function placeLoopNames(c: Canvas, g: ChartGeom, loops: readonly CausalLoop[], positions: Boxes): void {
  const names = loopNames(loops);
  loops.forEach((l, i) => {
    const ps = l.nodes.map(id => positions.get(id)!), x = ps.reduce((a, p) => a + p.x + p.w / 2, 0) / ps.length, bottom = Math.max(...ps.map(p => p.y + p.h)), top = Math.min(...ps.map(p => p.y));
    const home = {x, y: Math.min(c.y + c.h - 5, bottom + g.size + 6), anchor: 'middle' as const}, cands: Cand[] = [home, {x, y: top - 6, anchor: 'middle'}, {x, y: c.mid(ps.reduce((a, p) => a + p.y + p.h / 2, 0) / ps.length), anchor: 'middle'}];
    for (let k = 1; k <= 12; k++) for (const [dx, dy] of [[0, k], [0, -k], [k, 0], [-k, 0]]) cands.push({...home, x: x + dx * 8, y: home.y + dy * 8});
    c.place(names[i], cands, l.kind === 'R' ? 'accent' : 'danger', {bold: true, plate: true}) ?? c.text(names[i], home.x, home.y, 'middle', l.kind === 'R' ? 'accent' : 'danger', {bold: true, plate: true});
  });
}
