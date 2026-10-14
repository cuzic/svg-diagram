import type {Canvas, Cand, ChartGeom, LaidOutChartPart} from './charts-base.ts';
import {fail} from './charts-base.ts';
import type {Pt} from './graph-layout.ts';
import {textWidth} from './atoms.ts';
import {analyzeCausalLoops} from './semnet-analysis.ts';
import type {CausalLink, CausalLoop} from './semnet-analysis.ts';
import {checkRing, layoutRing} from './semnet-ring.ts';
import {arrow, direction, headBox, networkCanvas, nodeBox, pathOf, placeEdgeLabel, placePlated, touchesAny, validateNodes} from './semnet-common.ts';
import type {SemnetDirection, SemnetOpts} from './semnet-common.ts';

export interface CausalNode {id: string; label: string}
export interface CausalOpts extends SemnetOpts {
  /** `'ring'`: the nodes of a graph that is exactly one loop go round an ellipse, the links are arcs (a node outside the loop is not allowed; `direction` is not either). Default `'layered'`. */
  layout?: 'layered' | 'ring';
}

export interface CausalSpec {nodes: CausalNode[]; links: CausalLink[]; loops: CausalLoop[]; direction: SemnetDirection; layout: 'layered' | 'ring'}
export function resolveCausal(nodes: readonly CausalNode[], links: readonly CausalLink[], opts: CausalOpts = {}): CausalSpec {
  validateNodes('causalLoop', nodes, opts.id);
  const loops = analyzeCausalLoops(nodes.map(n => n.id), links), layout = opts.layout ?? 'layered';
  if (layout !== 'layered' && layout !== 'ring') fail('causalLoop', `layout must be 'layered' or 'ring' (got ${String(layout)})`);
  if (layout === 'ring') checkRing(nodes, links, loops, opts.direction);
  return {nodes: nodes.map(n => ({...n})), links: links.map(e => ({...e})), loops, direction: direction('causalLoop', opts.direction), layout};
}
/** R1, R2, B1, ...: loops are numbered within their kind. */
const loopNames = (loops: readonly CausalLoop[]): string[] => { const n = {R: 0, B: 0}; return loops.map(l => `${l.kind}${++n[l.kind]}`); };
export const causalAlt = (s: CausalSpec): string => { const names = loopNames(s.loops); return `Causal loop diagram. ${s.loops.map((l, i) => `${names[i]}: ${l.nodes.join(' → ')}`).join('; ') || 'No loops.'}`; };
export const causalTexts = (s: CausalSpec): [string, number][] => [...s.nodes.map(n => [n.label, 700] as [string, number]), ...s.links.flatMap(e => [[e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity, 700] as [string, number], ...(e.delay ? [['||', 700] as [string, number]] : []), ...(e.label ? [[e.label, 400] as [string, number]] : [])]), ...loopNames(s.loops).map(n => [n, 700] as [string, number])];

export function layoutCausal(s: CausalSpec, g: ChartGeom): LaidOutChartPart {
  const ns = s.nodes.map(n => ({...n, w: Math.max(116, textWidth(g.widthOf, n.label, g.size, 700) + 28), h: 48})), {c, positions, paths, centre} = s.layout === 'ring' ? layoutRing(g, ns, s.loops.find(l => l.nodes.length > 1)!, s.links.flatMap((e, index) => e.from === e.to ? [{index, node: e.from}] : [])) : {...networkCanvas(g, ns, s.links, s.direction, 28), centre: undefined};
  // Stage 1: every line and every box. Stage 2: the signs and names, over the finished lines (a sign placed between two edges' lines would be struck through by the later one).
  const edges = s.links.map((e, i) => { const p = pathOf(paths, i, e, positions); arrow(c, p, {stroke: 'text', dash: undefined}); return {e, p}; });
  for (const n of s.nodes) { const p = positions.get(n.id)!, host = nodeBox(c, p, n.id, n.label, 'text'); c.text(n.label, p.x + p.w / 2, c.mid(p.y + p.h / 2), 'middle', 'text', {bold: true, host, of: n.id}); }
  const heads = edges.map(({p}) => headBox(p));
  // what changes the meaning first (polarities, then delays), then the loop names, and the free text labels last
  // on a ring the first spots are straight out of / into the ring from the arc, where there is always room
  const radial = (m: Pt, text: string, bold = true): Cand[] => {
    if (!centre) return [];
    const dx = m.x - centre.x, dy = m.y - centre.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, d = 13 + Math.abs(ux) * c.tw(text, bold) / 2;
    return [1, -1].map(k => ({x: m.x + k * ux * d, y: c.mid(m.y + k * uy * 13), anchor: 'middle' as const}));
  };
  for (const {e, p} of edges) placePolarity(c, g, e, p, heads, radial);
  for (const {e, p} of edges) if (e.delay) placeDelay(c, g, e, p, heads, radial);
  placeLoopNames(c, g, s.loops, positions, heads, centre);
  for (const {e, p} of edges) if (e.label) placeLabel(c, g, e.label, p, heads, radial);
  return c.done();
}

type Rect = ReturnType<Canvas['boxOf']>;
type Boxes = Map<string, {x: number; y: number; w: number; h: number}>;
const signOf = (e: CausalLink): string => e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity;
/** A polarity or a delay mark that finds no room stops the build: without it the figure says something else (R reads as B). More height or width does not help, the room is beside the edge. */
const noRoom = (what: string, e: CausalLink): never => fail('causalLoop', `${what} of ${e.from} -> ${e.to} has no room (the figure is too dense around this link: drop a link or a node, or shorten the node labels; a larger height / width does not make room)`);
type Radial = (m: Pt, text: string, bold?: boolean) => Cand[];
function placePolarity(c: Canvas, g: ChartGeom, e: CausalLink, p: Pt[], heads: Rect[], radial: Radial): void {
  const sign = signOf(e);
  if (!placeEdgeLabel(c, sign, p, m => [...radial(m, sign), {x: m.x, y: m.y - 6, anchor: 'middle'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 12, y: m.y - 6, anchor: 'start'}], sign === '-' ? 'danger' : 'accent', {bold: true, plate: true}, heads)) noRoom(`the polarity "${sign}"`, e);
}
function placeDelay(c: Canvas, g: ChartGeom, e: CausalLink, p: Pt[], heads: Rect[], radial: Radial): void {
  if (!placeEdgeLabel(c, '||', p, m => [...radial(m, '||'), {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 14, y: m.y + g.size + 8, anchor: 'start'}], 'muted', {bold: true, plate: true}, heads)) noRoom('the delay mark "||"', e);
}
/** An edge's free text label: left out when there is no room (it does not change what the figure says; stopping would break figures that draw today). */
function placeLabel(c: Canvas, g: ChartGeom, text: string, p: Pt[], heads: Rect[], radial: Radial): void {
  placeEdgeLabel(c, text, p, m => [...radial(m, text, false), {x: m.x + 12, y: m.y - 6, anchor: 'start'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}], 'text', {plate: true}, heads);
}
/** R1 / B1 under the loop's lowest node; when a sign is already there: above the loop, at its centre, then outwards in 8px steps. Nothing free: where it used to go (the check reports it). */
function placeLoopNames(c: Canvas, g: ChartGeom, loops: readonly CausalLoop[], positions: Map<string, {x: number; y: number; w: number; h: number}>, heads: Rect[], centre?: Pt): void {
  const names = loopNames(loops);
  loops.forEach((l, i) => {
    const ps = l.nodes.map(id => positions.get(id)!), x = ps.reduce((a, p) => a + p.x + p.w / 2, 0) / ps.length, bottom = Math.max(...ps.map(p => p.y + p.h)), top = Math.min(...ps.map(p => p.y));
    const home = {x, y: Math.min(c.y + c.h - 5, bottom + g.size + 6), anchor: 'middle' as const}, cands: Cand[] = [home, {x, y: top - 6, anchor: 'middle'}, {x, y: c.mid(ps.reduce((a, p) => a + p.y + p.h / 2, 0) / ps.length), anchor: 'middle'}];
    if (centre && l.nodes.length > 1) cands.unshift({x: centre.x, y: c.mid(centre.y), anchor: 'middle'}); // a ring: the name goes in the middle
    for (let k = 1; k <= 12; k++) for (const [dx, dy] of [[0, k], [0, -k], [k, 0], [-k, 0]]) cands.push({...home, x: x + dx * 8, y: home.y + dy * 8});
    placePlated(c, names[i], cands, l.kind === 'R' ? 'accent' : 'danger', {bold: true, plate: true}, b => !touchesAny(b, heads)) ?? c.text(names[i], home.x, home.y, 'middle', l.kind === 'R' ? 'accent' : 'danger', {bold: true, plate: true});
  });
}
