import type {LaidOutChartPart, ChartGeom} from './charts-base.ts';
import {checkIds, checkText, fail, finiteNum, numText} from './charts-base.ts';
import {textWidth} from './atoms.ts';
import {analyzeCriticalPath} from './semnet-analysis.ts';
import type {PertAnalysis, PertTask} from './semnet-analysis.ts';
import {arrow, direction, headBox, networkCanvas, nodeBox, pathOf, placeEdgeLabel, validateNodes} from './semnet-common.ts';
import type {SemnetDirection, SemnetOpts} from './semnet-common.ts';
import {causalTexts} from './semnet-causal.ts';
import type {CausalSpec} from './semnet-causal.ts';

export {causalAlt, layoutCausal, resolveCausal} from './semnet-causal.ts';
export type {CausalSpec, CausalNode, CausalOpts} from './semnet-causal.ts';
export type {SemnetDirection} from './semnet-common.ts';

export interface PertOpts extends SemnetOpts {unit?: string; compact?: boolean}
export interface DependencyNode {id: string; label: string; kind?: string}
export type DependencyEdgeType = 'depends' | 'uses' | 'blocks' | 'relates' | (string & {});
export interface DependencyEdge {from: string; to: string; type: DependencyEdgeType; weight?: number; label?: string}
export interface DependencyOpts extends SemnetOpts {nodeKinds?: Record<string, string>; edgeTypes?: Record<string, string>}

export interface PertSpec {tasks: PertTask[]; analysis: PertAnalysis; direction: SemnetDirection; unit: string; compact: boolean}
export interface DependencySpec {nodes: DependencyNode[]; edges: DependencyEdge[]; direction: SemnetDirection; nodeKinds: Record<string, string>; edgeTypes: Record<string, string>}

export function resolvePert(tasks: readonly PertTask[], opts: PertOpts = {}): PertSpec {
  const analysis = analyzeCriticalPath(tasks);
  checkIds('pert', tasks.map(t => t.id), opts.id);
  return {tasks: tasks.map(t => ({...t, predecessors: [...(t.predecessors ?? [])]})), analysis, direction: direction('pert', opts.direction), unit: opts.unit ?? '', compact: !!opts.compact};
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
export const dependencyAlt = (s: DependencySpec): string => `Dependency network. ${s.edges.map(e => `${e.from} ${e.type} ${e.to}${e.weight === undefined ? '' : `, weight ${numText(e.weight)}`}`).join('; ')}`;

export function semnetTexts(kind: 'pert' | 'causal' | 'dependency', spec: PertSpec | CausalSpec | DependencySpec): [string, number][] {
  if (kind === 'pert') { const s = spec as PertSpec; return s.analysis.tasks.flatMap(t => [[t.label, 700], ...(s.compact ? [[`${numText(t.duration)}${s.unit} / 余裕 ${numText(t.slack)}`, 400]] : [[`ES ${numText(t.es)}`, 400], [`EF ${numText(t.ef)}`, 400], [`LS ${numText(t.ls)}`, 400], [`LF ${numText(t.lf)}`, 400], [`期間 ${numText(t.duration)}${s.unit} ・ 余裕 ${numText(t.slack)}`, t.critical ? 700 : 400]])] as [string, number][]); }
  if (kind === 'causal') return causalTexts(spec as CausalSpec);
  const s = spec as DependencySpec;
  const kinds = [...new Set(s.nodes.flatMap(n => n.kind ? [n.kind] : []))], types = [...new Set(s.edges.map(e => e.type))];
  return [...s.nodes.map(n => [n.label, 700] as [string, number]), ...s.edges.map(e => [[e.label ?? s.edgeTypes[e.type] ?? e.type, e.weight === undefined ? '' : numText(e.weight)].filter(Boolean).join(' '), 400] as [string, number]), ...kinds.map(k => [s.nodeKinds[k] ?? k, 400] as [string, number]), ...types.map(t => [s.edgeTypes[t] ?? t, 400] as [string, number])];
}

const kindTone =(i: number): 'accent' | 'danger' | 'muted' | 'text' => (['accent', 'danger', 'muted', 'text'] as const)[i % 4];
/** How an edge type is drawn; the legend uses the same style. */
const edgeStyle = (type: string, ti: number): {stroke: 'accent' | 'danger' | 'muted' | 'text'; dash?: string} => ({stroke: type === 'blocks' ? 'danger' : kindTone(ti), dash: type === 'uses' ? '8,5' : type === 'relates' ? '2,5' : type === 'blocks' ? '10,4,2,4' : ti > 3 ? (ti % 2 ? '8,5' : '2,5') : undefined});
export function layoutPert(s: PertSpec, g: ChartGeom): LaidOutChartPart {
  const w = s.compact ? 126 : 154, h = s.compact ? 64 : 104, ns = s.analysis.tasks.map(t => ({id: t.id, label: t.label, w: Math.max(w, textWidth(g.widthOf, t.label, g.size, 700) + 24), h}));
  const es = s.analysis.tasks.flatMap(t => t.predecessors.map(p => ({from: p, to: t.id}))), {c, positions, paths} = networkCanvas(g, ns, es, s.direction);
  es.forEach((e, i) => { const critical = s.analysis.criticalEdges.some(x => x.from === e.from && x.to === e.to); arrow(c, pathOf(paths, i, e, positions), {stroke: critical ? 'danger' : 'muted', sw: critical ? 4 : 2}); });
  for (const t of s.analysis.tasks) {
    const p = positions.get(t.id)!, host = nodeBox(c, p, t.id, t.label, t.critical ? 'danger' : 'text', t.critical), cx = p.x + p.w / 2;
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

export function layoutDependency(s: DependencySpec, g: ChartGeom): LaidOutChartPart {
  const kinds = [...new Set(s.nodes.flatMap(n => n.kind ? [n.kind] : []))], types = [...new Set(s.edges.map(e => e.type))];
  // legend: node kinds then edge types, wrapped into rows that fit the width
  const items = [...kinds.map((k, i) => ({kind: true, key: k, i, label: s.nodeKinds[k] ?? k})), ...types.map((t, i) => ({kind: false, key: t, i, label: s.edgeTypes[t] ?? t}))];
  const rowH = g.size + 10, rows: (typeof items)[] = [];
  let used = Infinity;
  for (const it of items) {
    const w = (it.kind ? 20 : 28) + textWidth(g.widthOf, it.label, g.size, 400) + 18;
    if (used + w - 18 > g.w - 8) { rows.push([]); used = 0; }
    rows.at(-1)!.push(it); used += w;
  }
  const legendH = rows.length ? 34 + (rows.length - 1) * rowH : 0;
  const ns = s.nodes.map(n => ({...n, w: Math.max(116, textWidth(g.widthOf, n.label, g.size, 700) + 28), h: 52})), {c, positions, paths} = networkCanvas(g, ns, s.edges, s.direction, legendH);
  // two stages: every line and box first, then the labels over them (a label drawn before a later edge's line would be struck through)
  const drawn = s.edges.map((e, i) => {
    const sw = e.weight === undefined ? 2 : Math.min(7, 1.5 + Math.sqrt(e.weight));
    const path = pathOf(paths, i, e, positions);
    arrow(c, path, {...edgeStyle(e.type, types.indexOf(e.type)), sw}, e.type !== 'relates');
    return {e, path, head: e.type === 'relates' ? [] : [headBox(path, sw)]};
  });
  const heads = drawn.flatMap(d => d.head);
  for (const n of s.nodes) { const p = positions.get(n.id)!, ki = n.kind ? kinds.indexOf(n.kind) : -1, tone = ki < 0 ? 'text' : kindTone(ki), host = nodeBox(c, p, n.id, n.label, tone); c.text(n.label, p.x + p.w / 2, c.mid(p.y + p.h / 2), 'middle', 'text', {bold: true, host, of: n.id}); }
  for (const {e, path} of drawn) {
    const text = [e.label ?? s.edgeTypes[e.type] ?? e.type, e.weight === undefined ? '' : numText(e.weight)].filter(Boolean).join(' ');
    // a label with no room is left out, as before (it does not change what the figure says, and stopping would break charts that draw today)
    placeEdgeLabel(c, text, path, m => [{x: m.x, y: m.y - 6, anchor: 'middle'}, {x: m.x, y: m.y + g.size + 8, anchor: 'middle'}, {x: m.x + 12, y: m.y - 6, anchor: 'start'}], 'text', {plate: true}, heads);
  }
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
