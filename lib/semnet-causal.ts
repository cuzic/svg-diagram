import type {Canvas, Cand, ChartGeom, LaidOutChartPart} from './charts-base.ts';
import {checkIds, checkText, fail} from './charts-base.ts';
import type {Pt} from './graph-layout.ts';
import {textWidth} from './atoms.ts';
import {must} from './must.ts';
import {analyzeCausalLoops} from './semnet-analysis.ts';
import type {CausalLink, CausalLoop, CausalPolarity} from './semnet-analysis.ts';
import {checkRing, layoutRing} from './semnet-ring.ts';
import {bandInset, planInterventions, ringSide} from './semnet-interventions.ts';
import type {IvItem, Side} from './semnet-interventions.ts';
import {arrow, direction, straightenOf, headBox, networkCanvas, nodeBox, pathOf, placeEdgeLabel, placePlated, touchesAny, validateNodes} from './semnet-common.ts';
import type {SemnetDirection, SemnetOpts} from './semnet-common.ts';

export interface CausalNode {id: string; label: string}
/** A point of leverage outside the loop: an arrow from `id` to each node in `to`. It is not a loop member (it has no incoming edge), so R/B classification and loop names never change. */
export interface CausalIntervention {
  id: string;
  label: string;
  /** The node(s) it acts on; several give one arrow each (polarity and delay are shared). */
  to: string | readonly string[];
  /** Strengthening the intervention moves the target the same way (`+` / `same`) or the opposite way (`-` / `opposite`). Required. */
  polarity: CausalPolarity;
  delay?: boolean;
}
export interface CausalOpts extends SemnetOpts {
  interventions?: readonly CausalIntervention[];
  /** `'ring'`: the nodes of a graph that is exactly one loop go round an ellipse, the links are arcs (a node outside the loop is not allowed; `direction` is not either). Default `'layered'`. */
  layout?: 'layered' | 'ring';
}

export interface ResolvedIntervention {id: string; label: string; to: string[]; polarity: CausalPolarity; delay: boolean}
export interface CausalSpec {nodes: CausalNode[]; links: CausalLink[]; loops: CausalLoop[]; direction: SemnetDirection; interventions: ResolvedIntervention[]; layout: 'layered' | 'ring'; straighten: boolean}
const POLARITIES = ['+', '-', 'same', 'opposite'];
function resolveInterventions(list: readonly CausalIntervention[] | undefined, nodes: readonly CausalNode[], bandId: string | undefined): ResolvedIntervention[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) fail('causalLoop', 'interventions must be an array');
  const nodeIds = new Set(nodes.map(n => n.id)), ivIds = new Set(list.map(v => v?.id));
  const out = list.map((v, i): ResolvedIntervention => {
    if (typeof v !== 'object' || v === null) fail('causalLoop', `interventions[${i}] must be an object {id, label, to, polarity}`);
    checkText('causalLoop', `interventions[${i}].id`, v.id); checkText('causalLoop', `intervention "${v.id}"'s label`, v.label);
    const to: string[] = typeof v.to === 'string' ? [v.to] : Array.isArray(v.to) ? [...v.to as string[]] : fail('causalLoop', `intervention "${v.id}": to must be a node id or an array of node ids`);
    if (!to.length) fail('causalLoop', `intervention "${v.id}": to needs at least one node id`);
    const ids = to.map((t, k) => {
      if (typeof t !== 'string') fail('causalLoop', `intervention "${v.id}": to[${k}] must be a node id (got ${String(t)})`);
      if (!nodeIds.has(t) && ivIds.has(t)) fail('causalLoop', `intervention "${v.id}": an intervention cannot act on the intervention "${t}" (to takes node ids; intervention -> intervention is not supported)`);
      if (!nodeIds.has(t)) fail('causalLoop', `intervention "${v.id}": to names unknown node "${t}" (nodes: ${[...nodeIds].join(', ')})`);
      if (to.indexOf(t) !== k) fail('causalLoop', `intervention "${v.id}": to lists node "${t}" twice`);
      return t;
    });
    if (!POLARITIES.includes(v.polarity)) fail('causalLoop', `intervention "${v.id}" has invalid polarity "${String(v.polarity)}" (+, -, same or opposite; it is required)`);
    if (v.delay !== undefined && typeof v.delay !== 'boolean') fail('causalLoop', `intervention "${v.id}": delay must be true or false`);
    return {id: v.id, label: v.label, to: ids, polarity: v.polarity, delay: !!v.delay};
  });
  checkIds('causalLoop', [...nodes.map(n => n.id), ...out.map(v => v.id)], bandId);
  return out;
}
export function resolveCausal(nodes: readonly CausalNode[], links: readonly CausalLink[], opts: CausalOpts = {}): CausalSpec {
  validateNodes('causalLoop', nodes, opts.id);
  const loops = analyzeCausalLoops(nodes.map(n => n.id), links), layout = opts.layout ?? 'layered';
  if (layout !== 'layered' && layout !== 'ring') fail('causalLoop', `layout must be 'layered' or 'ring' (got ${String(layout)})`);
  if (layout === 'ring') checkRing(nodes, links, loops, opts.direction);
  return {nodes: nodes.map(n => ({...n})), links: links.map(e => ({...e})), loops, direction: direction('causalLoop', opts.direction), interventions: resolveInterventions(opts.interventions, nodes, opts.id), layout, straighten: straightenOf('causalLoop', opts.straighten)};
}
/** R1, R2, B1, ...: loops are numbered within their kind. */
const loopNames = (loops: readonly CausalLoop[]): string[] => { const n = {R: 0, B: 0}; return loops.map(l => `${l.kind}${++n[l.kind]}`); };
const signText = (p: CausalPolarity): string => p === 'same' ? '+' : p === 'opposite' ? '-' : p;
export const causalAlt = (s: CausalSpec): string => {
  const names = loopNames(s.loops), label = (id: string): string => s.nodes.find(n => n.id === id)?.label ?? id;
  const iv = s.interventions.length ? ` Interventions: ${s.interventions.map(v => `${v.label} -> ${v.to.map(label).join(', ')} (${signText(v.polarity)}${v.delay ? ', delayed' : ''})`).join('; ')}.` : '';
  return `Causal loop diagram. ${s.loops.map((l, i) => `${names[i]}: ${l.nodes.join(' → ')}`).join('; ') || 'No loops.'}${iv}`;
};
export const causalTexts = (s: CausalSpec): [string, number][] => [...s.nodes.map(n => [n.label, 700] as [string, number]), ...s.links.flatMap(e => [[e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity, 700] as [string, number], ...(e.delay ? [['||', 700] as [string, number]] : []), ...(e.label ? [[e.label, 400] as [string, number]] : [])]), ...loopNames(s.loops).map(n => [n, 700] as [string, number]), ...s.interventions.flatMap(v => [[v.label, 700] as [string, number], [signText(v.polarity), 700] as [string, number], ...(v.delay ? [['||', 700] as [string, number]] : [])])];

export function layoutCausal(s: CausalSpec, g: ChartGeom): LaidOutChartPart {
  const ns = s.nodes.map(n => ({...n, w: Math.max(116, textWidth(g.widthOf, n.label, g.size, 700) + 28), h: 48})), loop = s.layout === 'ring' ? s.loops.find(l => l.nodes.length > 1) : undefined;
  const selfs = s.links.flatMap((e, index) => e.from === e.to ? [{index, node: e.from}] : []);
  const items: IvItem[] = s.interventions.map(v => ({id: v.id, label: v.label, to: v.to, w: textWidth(g.widthOf, v.label, g.size, 700) + 28}));
  // the band is one edge: the top for LR, the left for TB, above and below a ring; the loop gets that much less room, and a thicker band when an arrow finds no way through
  const sideOf = (it: IvItem): Side => loop ? ringSide(loop.nodes, it.to) : s.direction === 'TB' ? 'left' : 'top';
  let laid: {c: Canvas; positions: Map<string, {x: number; y: number; w: number; h: number}>; paths: Map<number, Pt[]>; centre: Pt | undefined}, plan: ReturnType<typeof planInterventions> | undefined;
  for (let attempt = 0; ; attempt++) {
    const has = (side: Side): IvItem[] => items.filter(it => sideOf(it) === side), inset = (side: Side): number => has(side).length ? bandInset(side, has(side), attempt) : 0;
    laid = loop ? layoutRing(g, ns, loop, selfs, items.length ? {top: inset('top'), bottom: inset('bottom')} : undefined)
      : {...networkCanvas(g, ns, s.links, s.direction, 28, s.straighten, items.length ? {top: inset('top'), left: inset('left')} : undefined), centre: undefined};
    if (!items.length) break;
    plan = planInterventions(laid.c, items, laid.positions, sideOf);
    if ('placed' in plan) break;
    if (attempt === 3) fail('causalLoop', `${plan.problem} (even with a thicker band; shorten the intervention labels, name fewer targets, or give the loop more room with a larger width)`);
  }
  const {c, positions, paths, centre} = laid;
  // Stage 1: every line and every box. Stage 2: the signs and names, over the finished lines (a sign placed between two edges' lines would be struck through by the later one).
  const edges = s.links.map((e, i) => { const p = pathOf(paths, i, e, positions); arrow(c, p, {stroke: 'text', dash: undefined, ...(s.layout === 'ring' ? {} : {edge: e})}); return {e, p}; });
  for (const n of s.nodes) { const p = must(positions.get(n.id)), host = nodeBox(c, p, n.id, n.label, 'text'); c.text(n.label, p.x + p.w / 2, c.mid(p.y + p.h / 2), 'middle', 'text', {bold: true, host, of: n.id}); }
  // the interventions: a dashed box (an anchor, like a node) and a dashed arrow to each target
  const ivEdges: {e: CausalLink; p: Pt[]}[] = [];
  for (const {item, box, arrows} of plan && 'placed' in plan ? plan.placed : []) {
    const v = must(s.interventions.find(x => x.id === item.id)), host = c.rect(box.x, box.y, box.w, box.h, {fill: 'bg', stroke: 'accent', sw: 2, dash: '6,4', id: v.id, of: v.id, solid: `intervention "${v.label}"`});
    c.text(v.label, box.x + box.w / 2, c.mid(box.y + box.h / 2), 'middle', 'text', {bold: true, host, of: v.id});
    for (const a of arrows) { arrow(c, a.path, {stroke: 'accent', dash: '6,4'}); ivEdges.push({e: {from: v.id, to: a.to, polarity: v.polarity, ...(v.delay ? {delay: true} : {})}, p: a.path}); }
  }
  const heads = [...edges, ...ivEdges].map(({p}) => headBox(p));
  // what changes the meaning first (polarities, then delays), then the loop names, and the free text labels last
  // on a ring the first spots are straight out of / into the ring from the arc, where there is always room
  const radial = (m: Pt, text: string, bold = true): Cand[] => {
    if (!centre) return [];
    const dx = m.x - centre.x, dy = m.y - centre.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, d = 13 + Math.abs(ux) * c.tw(text, bold) / 2;
    return [1, -1].map(k => ({x: m.x + k * ux * d, y: c.mid(m.y + k * uy * 13), anchor: 'middle' as const}));
  };
  for (const {e, p} of edges) placePolarity(c, g, e, p, heads, radial);
  for (const {e, p} of edges) if (e.delay) placeDelay(c, g, e, p, heads, radial);
  for (const {e, p} of ivEdges) placePolarity(c, g, e, p, heads, () => []);
  for (const {e, p} of ivEdges) if (e.delay) placeDelay(c, g, e, p, heads, () => []);
  placeLoopNames(c, g, s.loops, positions, heads, centre);
  for (const {e, p} of edges) if (e.label) placeLabel(c, g, e.label, p, heads, radial);
  return c.done();
}

type Rect = ReturnType<Canvas['boxOf']>;
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
    const ps = l.nodes.map(id => must(positions.get(id))), x = ps.reduce((a, p) => a + p.x + p.w / 2, 0) / ps.length, bottom = Math.max(...ps.map(p => p.y + p.h)), top = Math.min(...ps.map(p => p.y));
    const home = {x, y: Math.min(c.y + c.h - 5, bottom + g.size + 6), anchor: 'middle' as const}, cands: Cand[] = [home, {x, y: top - 6, anchor: 'middle'}, {x, y: c.mid(ps.reduce((a, p) => a + p.y + p.h / 2, 0) / ps.length), anchor: 'middle'}];
    if (centre && l.nodes.length > 1) cands.unshift({x: centre.x, y: c.mid(centre.y), anchor: 'middle'}); // a ring: the name goes in the middle
    for (let k = 1; k <= 12; k++) { const ring: [number, number][] = [[0, k], [0, -k], [k, 0], [-k, 0]]; for (const [dx, dy] of ring) cands.push({...home, x: x + dx * 8, y: home.y + dy * 8}); }
    const name = must(names[i]);
    placePlated(c, name, cands, l.kind === 'R' ? 'accent' : 'danger', {bold: true, plate: true}, b => !touchesAny(b, heads)) ?? c.text(name, home.x, home.y, 'middle', l.kind === 'R' ? 'accent' : 'danger', {bold: true, plate: true});
  });
}
