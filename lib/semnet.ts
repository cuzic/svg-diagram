import type {ChartOpts, LaidOutChartPart, ChartGeom} from './charts-base.ts';
import {Canvas, checkIds, checkText, fail, finiteNum, numText} from './charts-base.ts';
import {layoutWithLanes} from './layered-route.ts';
import {routeLayered} from './layered-route.ts';
import type {Pt} from './graph-layout.ts';
import {textWidth} from './atoms.ts';
import {analyzeCausalLoops, analyzeCriticalPath} from './semnet-analysis.ts';
import type {CausalLink, CausalLoop, PertAnalysis, PertTask} from './semnet-analysis.ts';

import {must} from './must.ts';
export type SemnetDirection = 'LR' | 'TB';
interface SemnetOpts extends ChartOpts {direction?: SemnetDirection}
export interface PertOpts extends SemnetOpts {unit?: string; compact?: boolean}
export interface CausalNode {id: string; label: string}
export interface CausalOpts extends SemnetOpts {}
export interface DependencyNode {id: string; label: string; kind?: string}
export type DependencyEdgeType = 'depends' | 'uses' | 'blocks' | 'relates' | (string & {});
export interface DependencyEdge {from: string; to: string; type: DependencyEdgeType; weight?: number; label?: string}
export interface DependencyOpts extends SemnetOpts {nodeKinds?: Record<string, string>; edgeTypes?: Record<string, string>}

export interface PertSpec {tasks: PertTask[]; analysis: PertAnalysis; direction: SemnetDirection; unit: string; compact: boolean}
export interface CausalSpec {nodes: CausalNode[]; links: CausalLink[]; loops: CausalLoop[]; direction: SemnetDirection}
export interface DependencySpec {nodes: DependencyNode[]; edges: DependencyEdge[]; direction: SemnetDirection; nodeKinds: Record<string, string>; edgeTypes: Record<string, string>}

const direction = (who: string, d: SemnetDirection | undefined): SemnetDirection => { if (d !== undefined && d !== 'LR' && d !== 'TB') fail(who, `direction must be LR or TB (got ${String(d)})`); return d ?? 'LR'; };
const validateNodes = (who: string, nodes: readonly {id: string; label: string}[], bandId?: string): void => {
  if (!nodes.length) fail(who, 'needs at least one node');
  nodes.forEach((n, i) => { checkText(who, `nodes[${i}].id`, n.id); checkText(who, `node "${n.id}"'s label`, n.label); });
  checkIds(who, nodes.map(n => n.id), bandId);
};

export function resolvePert(tasks: readonly PertTask[], opts: PertOpts = {}): PertSpec {
  const analysis = analyzeCriticalPath(tasks);
  checkIds('pert', tasks.map(t => t.id), opts.id);
  return {tasks: tasks.map(t => ({...t, predecessors: [...(t.predecessors ?? [])]})), analysis, direction: direction('pert', opts.direction), unit: opts.unit ?? '', compact: !!opts.compact};
}
export function resolveCausal(nodes: readonly CausalNode[], links: readonly CausalLink[], opts: CausalOpts = {}): CausalSpec {
  validateNodes('causalLoop', nodes, opts.id);
  const loops = analyzeCausalLoops(nodes.map(n => n.id), links);
  return {nodes: nodes.map(n => ({...n})), links: links.map(e => ({...e})), loops, direction: direction('causalLoop', opts.direction)};
}
export function resolveDependency(nodes: readonly DependencyNode[], edges: readonly DependencyEdge[], opts: DependencyOpts = {}): DependencySpec {
  validateNodes('dependencyNetwork', nodes, opts.id);
  const ids = new Set(nodes.map(n => n.id));
  edges.forEach((e, i) => {
    if (!ids.has(e.from) || !ids.has(e.to)) fail('dependencyNetwork', `edges[${i}] ${e.from} -> ${e.to} names unknown node`);
    checkText('dependencyNetwork', `edges[${i}].type`, e.type);
    if (e.weight !== undefined) finiteNum('dependencyNetwork', `edges[${i}].weight`, e.weight, {min: 0});
  });
  return {nodes: nodes.map(n => ({...n})), edges: edges.map(e => ({...e})), direction: direction('dependencyNetwork', opts.direction), nodeKinds: {...(opts.nodeKinds ?? {})}, edgeTypes: {...(opts.edgeTypes ?? {})}};
}

export const pertAlt = (s: PertSpec): string => `PERT network. Project duration ${numText(s.analysis.duration)}${s.unit}. Critical path: ${s.analysis.criticalPath.join(' → ')}. ${s.analysis.tasks.map(t => `${t.label}: duration ${numText(t.duration)}, ES ${numText(t.es)}, EF ${numText(t.ef)}, LS ${numText(t.ls)}, LF ${numText(t.lf)}, slack ${numText(t.slack)}`).join('; ')}`;
/** R1, R2, B1, ...: loops are numbered within their kind. */
const loopNames = (loops: readonly CausalLoop[]): string[] => { const n = {R: 0, B: 0}; return loops.map(l => `${l.kind}${++n[l.kind]}`); };
export const causalAlt = (s: CausalSpec): string => { const names = loopNames(s.loops); return `Causal loop diagram. ${s.loops.map((l, i) => `${names[i]}: ${l.nodes.join(' → ')}`).join('; ') || 'No loops.'}`; };
export const dependencyAlt = (s: DependencySpec): string => `Dependency network. ${s.edges.map(e => `${e.from} ${e.type} ${e.to}${e.weight === undefined ? '' : `, weight ${numText(e.weight)}`}`).join('; ')}`;

export function semnetTexts(kind: 'pert' | 'causal' | 'dependency', spec: PertSpec | CausalSpec | DependencySpec): [string, number][] {
  if (kind === 'pert') { const s = spec as PertSpec; return s.analysis.tasks.flatMap(t => [[t.label, 700], ...(s.compact ? [[`${numText(t.duration)}${s.unit} / 余裕 ${numText(t.slack)}`, 400]] : [[`ES ${numText(t.es)}`, 400], [`EF ${numText(t.ef)}`, 400], [`LS ${numText(t.ls)}`, 400], [`LF ${numText(t.lf)}`, 400], [`期間 ${numText(t.duration)}${s.unit} ・ 余裕 ${numText(t.slack)}`, t.critical ? 700 : 400]])] as [string, number][]); }
  if (kind === 'causal') { const s = spec as CausalSpec; return [...s.nodes.map(n => [n.label, 700] as [string, number]), ...s.links.flatMap(e => [[e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity, 700] as [string, number], ...(e.delay ? [['||', 700] as [string, number]] : []), ...(e.label ? [[e.label, 400] as [string, number]] : [])]), ...loopNames(s.loops).map(n => [n, 700] as [string, number])]; }
  const s = spec as DependencySpec;
  const kinds = [...new Set(s.nodes.flatMap(n => n.kind ? [n.kind] : []))], types = [...new Set(s.edges.map(e => e.type))];
  return [...s.nodes.map(n => [n.label, 700] as [string, number]), ...s.edges.map(e => [[e.label ?? s.edgeTypes[e.type] ?? e.type, e.weight === undefined ? '' : numText(e.weight)].filter(Boolean).join(' '), 400] as [string, number]), ...kinds.map(k => [s.nodeKinds[k] ?? k, 400] as [string, number]), ...types.map(t => [s.edgeTypes[t] ?? t, 400] as [string, number])];
}

const r = (n: number): number => Math.round(n * 10) / 10;
function arrow(c: Canvas, points: Pt[], o: {stroke: 'accent' | 'danger' | 'muted' | 'text'; sw?: number; dash?: string; of?: string}, mark = true): void {
  for (let i = 1; i < points.length; i++) c.line(must(points[i - 1]).x, must(points[i - 1]).y, must(points[i]).x, must(points[i]).y, {...o, avoid: true});
  if (!mark || points.length < 2) return;
  const b = must(points.at(-1)), a = must(points.at(-2)), dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux, z = 7 + (o.sw ?? 2);
  c.path(`M${r(b.x)},${r(b.y)} L${r(b.x - ux * z + px * z * .55)},${r(b.y - uy * z + py * z * .55)} L${r(b.x - ux * z - px * z * .55)},${r(b.y - uy * z - py * z * .55)} Z`, {fill: o.stroke, of: o.of});
}
const edgeMid = (p: Pt[]): Pt => { const i = Math.max(0, Math.floor((p.length - 1) / 2)); return {x: (must(p[i]).x + must(p[i + 1]).x) / 2, y: (must(p[i]).y + must(p[i + 1]).y) / 2}; };
const pathOf = (paths: Map<number, Pt[]>, i: number, e: {from: string; to: string}, positions: Map<string, {x: number; y: number; w: number; h: number}>): Pt[] => {
  const routed = paths.get(i); if (routed) return routed;
  const n = must(positions.get(e.from)); // self loop (routeLayered deliberately leaves these to the caller)
  return [{x: n.x + n.w, y: n.y + n.h * .7}, {x: n.x + n.w + 24, y: n.y + n.h * .7}, {x: n.x + n.w + 24, y: n.y - 18}, {x: n.x + n.w * .7, y: n.y - 18}, {x: n.x + n.w * .7, y: n.y}];
};
const kindTone = (i: number): 'accent' | 'danger' | 'muted' | 'text' => must((['accent', 'danger', 'muted', 'text'] as const)[i % 4]);
/** How an edge type is drawn; the legend uses the same style. */
const edgeStyle = (type: string, ti: number): {stroke: 'accent' | 'danger' | 'muted' | 'text'; dash?: string} => ({stroke: type === 'blocks' ? 'danger' : kindTone(ti), dash: type === 'uses' ? '8,5' : type === 'relates' ? '2,5' : type === 'blocks' ? '10,4,2,4' : ti > 3 ? (ti % 2 ? '8,5' : '2,5') : undefined});

function networkCanvas(g: ChartGeom, nodes: {id: string; label: string; w: number; h: number}[], edges: {from: string; to: string}[], dir: SemnetDirection, legendH = 0): {c: Canvas; positions: Map<string, {x: number; y: number; w: number; h: number}>; paths: Map<number, Pt[]>} {
  // Orthogonal routing works in the layout's right-running axes; TB is that geometry transposed.
  const vertical = dir === 'TB';
  const lay = layoutWithLanes(nodes.map(n => ({id: n.id, size: vertical ? {w: n.h, h: n.w} : {w: n.w, h: n.h}})), edges, {dir: 'right', gap: 28, levelGap: 76});
  const naturalW = vertical ? lay.h : lay.w, naturalH = vertical ? lay.w : lay.h;
  const scale = Math.min(1, (g.w - 8) / Math.max(1, naturalW)), ox = g.x + (g.w - naturalW * scale) / 2, oy = g.y + 8;
  const place = (p: Pt): Pt => vertical ? {x: ox + p.y * scale, y: oy + p.x * scale} : {x: ox + p.x * scale, y: oy + p.y * scale};
  const positions = new Map<string, {x: number; y: number; w: number; h: number}>();
  for (const [id, p] of lay.nodes) positions.set(id, vertical ? {x: ox + p.y * scale, y: oy + p.x * scale, w: p.h * scale, h: p.w * scale} : {x: ox + p.x * scale, y: oy + p.y * scale, w: p.w * scale, h: p.h * scale});
  const paths = routeLayered(lay, place);
  const h = Math.max(g.height ?? 0, naturalH * scale + 16 + legendH), c = new Canvas(g.x, g.y, g.w, h, g.size, g.widthOf);
  for (const n of nodes) { const p = must(positions.get(n.id)); c.solids.push({...p, id: n.id, label: `node "${n.label}"`}); }
  return {c, positions, paths};
}

function nodeBox(c: Canvas, p: {x: number; y: number; w: number; h: number}, id: string, _label: string, tone: 'accent' | 'danger' | 'muted' | 'text', critical = false): number {
  c.rect(p.x, p.y, p.w, p.h, {fill: critical ? 'accent' : 'bg', op: critical ? .16 : undefined, stroke: tone, sw: critical ? 4 : 2, id, of: id});
  return c.solids.findIndex(s => s.id === id);
}

export function layoutPert(s: PertSpec, g: ChartGeom): LaidOutChartPart {
  const w = s.compact ? 126 : 154, h = s.compact ? 64 : 104, ns = s.analysis.tasks.map(t => ({id: t.id, label: t.label, w: Math.max(w, textWidth(g.widthOf, t.label, g.size, 700) + 24), h}));
  const es = s.analysis.tasks.flatMap(t => t.predecessors.map(p => ({from: p, to: t.id}))), {c, positions, paths} = networkCanvas(g, ns, es, s.direction);
  es.forEach((e, i) => { const critical = s.analysis.criticalEdges.some(x => x.from === e.from && x.to === e.to); arrow(c, pathOf(paths, i, e, positions), {stroke: critical ? 'danger' : 'muted', sw: critical ? 4 : 2}); });
  for (const t of s.analysis.tasks) {
    const p = must(positions.get(t.id)), host = nodeBox(c, p, t.id, t.label, t.critical ? 'danger' : 'text', t.critical), cx = p.x + p.w / 2;
    c.text(t.label, cx, p.y + g.size + 8, 'middle', 'text', {bold: true, host, of: t.id});
    if (s.compact) c.text(`${numText(t.duration)}${s.unit} / 余裕 ${numText(t.slack)}`, cx, p.y + p.h - 10, 'middle', t.critical ? 'danger' : 'muted', {host, of: t.id});
    else {
      const y = p.y + 2 * g.size + 14, left = p.x + 9, right = p.x + p.w - 9;
      c.text(`ES ${numText(t.es)}`, left, y, 'start', 'muted', {host, of: t.id}); c.text(`EF ${numText(t.ef)}`, right, y, 'end', 'muted', {host, of: t.id});
      c.text(`LS ${numText(t.ls)}`, left, y + c.lineH(), 'start', 'muted', {host, of: t.id}); c.text(`LF ${numText(t.lf)}`, right, y + c.lineH(), 'end', 'muted', {host, of: t.id});
      c.text(`期間 ${numText(t.duration)}${s.unit} ・ 余裕 ${numText(t.slack)}`, cx, p.y + p.h - 8, 'middle', t.critical ? 'danger' : 'text', {bold: t.critical, host, of: t.id});
    }
  }
  return c.done();
}

export function layoutCausal(s: CausalSpec, g: ChartGeom): LaidOutChartPart {
  const ns = s.nodes.map(n => ({...n, w: Math.max(116, textWidth(g.widthOf, n.label, g.size, 700) + 28), h: 48})), {c, positions, paths} = networkCanvas(g, ns, s.links, s.direction, 28);
  s.links.forEach((e, i) => {
    const p = pathOf(paths, i, e, positions); arrow(c, p, {stroke: 'text', dash: undefined});
    const m = edgeMid(p), sign = e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity;
    c.place(sign, [{x: m.x, y: m.y - 6, anchor: 'middle'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 12, y: m.y - 6, anchor: 'start'}], sign === '-' ? 'danger' : 'accent', {bold: true, plate: true});
    if (e.delay) c.place('||', [{x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 14, y: m.y + g.size + 8, anchor: 'start'}], 'muted', {bold: true, plate: true});
    if (e.label) c.place(e.label, [{x: m.x + 12, y: m.y - 6, anchor: 'start'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}], 'text', {plate: true});
  });
  for (const n of s.nodes) { const p = must(positions.get(n.id)), host = nodeBox(c, p, n.id, n.label, 'text'); c.text(n.label, p.x + p.w / 2, c.mid(p.y + p.h / 2), 'middle', 'text', {bold: true, host, of: n.id}); }
  const names = loopNames(s.loops);
  s.loops.forEach((l, i) => {
    const ps = l.nodes.map(id => must(positions.get(id))), x = ps.reduce((a, p) => a + p.x + p.w / 2, 0) / ps.length, bottom = Math.max(...ps.map(p => p.y + p.h));
    c.text(must(names[i]), x, Math.min(c.y + c.h - 5, bottom + g.size + 6), 'middle', l.kind === 'R' ? 'accent' : 'danger', {bold: true, plate: true});
  });
  return c.done();
}

export function layoutDependency(s: DependencySpec, g: ChartGeom): LaidOutChartPart {
  const kinds = [...new Set(s.nodes.flatMap(n => n.kind ? [n.kind] : []))], types = [...new Set(s.edges.map(e => e.type))];
  // legend: node kinds then edge types, wrapped into rows that fit the width
  const items = [...kinds.map((k, i) => ({kind: true, key: k, i, label: s.nodeKinds[k] ?? k})), ...types.map((t, i) => ({kind: false, key: t, i, label: s.edgeTypes[t] ?? t}))];
  const rowH = g.size + 10, rows: (typeof items)[] = [];
  let used = Infinity;
  for (const it of items) {
    const w = (it.kind ? 20 : 28) + textWidth(g.widthOf, it.label, g.size, 400) + 18;
    if (used + w - 18 > g.w - 8) { rows.push([]); used = 0; }
    must(rows.at(-1)).push(it); used += w;
  }
  const legendH = rows.length ? 34 + (rows.length - 1) * rowH : 0;
  const ns = s.nodes.map(n => ({...n, w: Math.max(116, textWidth(g.widthOf, n.label, g.size, 700) + 28), h: 52})), {c, positions, paths} = networkCanvas(g, ns, s.edges, s.direction, legendH);
  s.edges.forEach((e, i) => {
    const sw = e.weight === undefined ? 2 : Math.min(7, 1.5 + Math.sqrt(e.weight));
    const path = pathOf(paths, i, e, positions);
    arrow(c, path, {...edgeStyle(e.type, types.indexOf(e.type)), sw}, e.type !== 'relates');
    const text = [e.label ?? s.edgeTypes[e.type] ?? e.type, e.weight === undefined ? '' : numText(e.weight)].filter(Boolean).join(' '), m = edgeMid(path);
    c.place(text, [{x: m.x, y: m.y - 6, anchor: 'middle'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 12, y: m.y - 6, anchor: 'start'}], 'text', {plate: true});
  });
  for (const n of s.nodes) { const p = must(positions.get(n.id)), ki = n.kind ? kinds.indexOf(n.kind) : -1, tone = ki < 0 ? 'text' : kindTone(ki), host = nodeBox(c, p, n.id, n.label, tone); c.text(n.label, p.x + p.w / 2, c.mid(p.y + p.h / 2), 'middle', 'text', {bold: true, host, of: n.id}); }
  rows.forEach((row, r) => {
    let x = c.x + 4;
    const base = c.y + c.h - 5 - (rows.length - 1 - r) * rowH;
    for (const it of row) {
      if (it.kind) { c.rect(x, base - g.size + 2, 14, 10, {fill: 'bg', stroke: kindTone(it.i), sw: 2}); x += 20; } else { c.line(x, base - 4, x + 22, base - 4, edgeStyle(it.key, it.i)); x += 28; }
      c.text(it.label, x, base, 'start', 'text'); x += c.tw(it.label) + 18;
    }
  });
  return c.done();
}
