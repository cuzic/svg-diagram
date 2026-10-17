// sankey(): flows between layers of nodes. The height of a node and the thickness of a ribbon are proportional to the value they carry
// (one scale for the whole figure), nodes never overlap, ribbons are paths from one node to the next. Nodes are layered from the sources
// (longest path), and ordered inside a layer by the position of the nodes they connect to, to keep ribbons from crossing.
import {Canvas, checkText, fail, finiteNum, numText} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';
import type {IconName} from './icons.ts';
import type {IconGlyph} from './icon-store.ts';

export interface SankeyNode {
  id: string; label?: string; tone?: ChartTone;
  /** An installed SVG icon (see `icon`) before the node's label, as tall as a line of it. */
  icon?: IconName;
  /** Internal: the installed path of `icon`, resolved by sankey(). */
  iconGlyph?: IconGlyph;
}
export interface SankeyLink {from: string; to: string; value: number; /** `danger` ribbons are drawn with a dashed outline too. */ tone?: Extract<ChartTone, 'accent' | 'danger' | 'muted'>}
export interface SankeyOpts extends ChartOpts {
  unit?: string;
  /** Where the nodes with no outflow go: 'justify' (the last layer, default) or 'left' (where their longest path ends). */
  align?: 'justify' | 'left';
  /** Print the value on each ribbon thick enough for it (default true). */
  linkLabels?: boolean;
}
export interface SankeySpec {nodes: {id: string; label: string; tone: ChartTone; icon?: {name: string; glyph: IconGlyph}}[]; links: {from: string; to: string; value: number; tone: 'accent' | 'danger' | 'muted'}[]; unit: string; align: 'justify' | 'left'; linkLabels: boolean}

export function resolveSankey(nodes: readonly (SankeyNode | string)[], links: readonly SankeyLink[], opts: SankeyOpts): SankeySpec {
  if (!Array.isArray(nodes) || nodes.length < 2) fail('sankey', 'needs at least two nodes');
  if (nodes.length > 40) fail('sankey', `${nodes.length} nodes are too many for one figure (at most 40)`);
  if (!Array.isArray(links) || links.length < 1) fail('sankey', 'needs at least one link');
  const ns = nodes.map(n => typeof n === 'string' ? {id: n, label: n, tone: 'text' as ChartTone} : {id: checkText('sankey', 'a node id', n.id), label: n.label ?? n.id, tone: n.tone ?? 'text' as ChartTone, ...(n.icon !== undefined ? {icon: {name: n.icon, glyph: n.iconGlyph as IconGlyph}} : {})});
  const ids = new Set<string>();
  for (const n of ns) { checkText('sankey', `node "${n.id}"'s label`, n.label); if (ids.has(n.id)) fail('sankey', `node id "${n.id}" is used twice`); ids.add(n.id); }
  if (opts.id !== undefined && ids.has(opts.id)) fail('sankey', `the band's id "${opts.id}" is also a node's id — each id must be unique`);
  const seen = new Set<string>();
  const ls = links.map((l, i) => {
    if (!ids.has(l.from)) fail('sankey', `link ${i + 1}: unknown node "${l.from}" (declared: ${[...ids].join(', ')})`);
    if (!ids.has(l.to)) fail('sankey', `link ${i + 1}: unknown node "${l.to}" (declared: ${[...ids].join(', ')})`);
    if (l.from === l.to) fail('sankey', `link ${i + 1}: "${l.from}" flows into itself`);
    const key = `${l.from}>${l.to}`;
    if (seen.has(key)) fail('sankey', `link ${i + 1}: "${l.from}" -> "${l.to}" is given twice (add the values into one link)`);
    seen.add(key);
    const value = finiteNum('sankey', `link ${i + 1}'s value`, l.value);
    if (!(value > 0)) fail('sankey', `link ${i + 1} ("${l.from}" -> "${l.to}"): value must be > 0 (got ${l.value})`);
    if (l.tone !== undefined && !['accent', 'danger', 'muted'].includes(l.tone)) fail('sankey', `link ${i + 1}: tone must be accent, danger or muted`);
    return {from: l.from, to: l.to, value, tone: l.tone ?? 'accent' as const};
  });
  // a node no link touches carries no flow: it would have no height, and the scale would be worked out from its zero flow
  for (const n of ns) if (!ls.some(l => l.from === n.id || l.to === n.id)) fail('sankey', `node "${n.id}" has no link (leave it out, or link it)`);
  const spec: SankeySpec = {nodes: ns, links: ls, unit: opts.unit ?? '', align: opts.align ?? 'justify', linkLabels: opts.linkLabels !== false};
  layersOf(spec); // a cycle is an error now, not at layout
  return spec;
}
/** The layer of each node: the longest path from a source (a cycle throws); sinks go to the last layer unless align is 'left'. */
export function layersOf(s: SankeySpec): Map<string, number> {
  const layer = new Map<string, number>(), state = new Map<string, 1 | 2>();
  const into = (id: string) => s.links.filter(l => l.to === id).map(l => l.from);
  const visit = (id: string, trail: string[]): number => {
    if (state.get(id) === 2) return layer.get(id)!;
    if (state.get(id) === 1) fail('sankey', `the links form a cycle (${[...trail.slice(trail.indexOf(id)), id].join(' -> ')}); a sankey flows one way`);
    state.set(id, 1);
    const l = Math.max(-1, ...into(id).map(p => visit(p, [...trail, id]))) + 1;
    state.set(id, 2); layer.set(id, l);
    return l;
  };
  for (const n of s.nodes) visit(n.id, []);
  const last = Math.max(...layer.values());
  if (s.align === 'justify') for (const n of s.nodes) if (!s.links.some(l => l.from === n.id)) layer.set(n.id, last);
  return layer;
}
const flowOf = (s: SankeySpec, id: string): number => Math.max(s.links.filter(l => l.to === id).reduce((a, l) => a + l.value, 0), s.links.filter(l => l.from === id).reduce((a, l) => a + l.value, 0));
const val = (v: number, s: SankeySpec): string => `${numText(parseFloat(v.toPrecision(12)))}${s.unit}`;
export function sankeyAlt(s: SankeySpec): string {
  const name = (id: string) => s.nodes.find(n => n.id === id)!.label;
  return `サンキー図: ${s.links.map(l => `${name(l.from)} → ${name(l.to)} ${val(l.value, s)}`).join('、')}`;
}
export function sankeyTexts(s: SankeySpec): [string, number][] {
  const out: [string, number][] = [];
  for (const n of s.nodes) out.push([n.label, 400], [n.label, 700], [val(flowOf(s, n.id), s), 700], [`${n.label} ${val(flowOf(s, n.id), s)}`, 400], [`${n.label} ${val(flowOf(s, n.id), s)}`, 700]);
  for (const l of s.links) out.push([val(l.value, s), 400], [val(l.value, s), 700]);
  return out;
}

export function layoutSankey(s: SankeySpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf, g.wrap), lh = c.lineH(), r1 = (v: number) => Math.round(v * 10) / 10;
  const layer = layersOf(s), L = Math.max(...layer.values()) + 1;
  const cols: string[][] = Array.from({length: L}, () => []);
  for (const n of s.nodes) cols[layer.get(n.id)!].push(n.id);
  // order inside each layer: barycentre sweeps (towards the sinks, then back), keeping the given order for ties
  const pos = new Map<string, number>();
  cols.forEach(col => col.forEach((id, i) => pos.set(id, i)));
  const bary = (id: string, side: 'in' | 'out'): number => {
    const ws = s.links.filter(l => side === 'in' ? l.to === id : l.from === id);
    return ws.length ? ws.reduce((a, l) => a + (pos.get(side === 'in' ? l.from : l.to) ?? 0) * l.value, 0) / ws.reduce((a, l) => a + l.value, 0) : pos.get(id)!;
  };
  for (let it = 0; it < 4; it++) {
    for (const dir of ['in', 'out'] as const) {
      const order = dir === 'in' ? cols.map((_, i) => i) : cols.map((_, i) => L - 1 - i);
      for (const li of order) {
        const col = cols[li];
        const before = new Map(col.map((id, i) => [id, i]));
        col.sort((a, b) => bary(a, dir) - bary(b, dir) || before.get(a)! - before.get(b)!);
        col.forEach((id, i) => pos.set(id, i));
      }
    }
  }
  // geometry: node width, layer pitch, label room on the right of the last layer
  const nodeW = 14, iconW = c.lineH() + 4, iconOf = (id: string) => s.nodes.find(n => n.id === id)!.icon ? iconW : 0, nameOf = (id: string) => s.nodes.find(n => n.id === id)!;
  const lastNatural = Math.max(...cols[L - 1].map(id => c.tw(`${nameOf(id).label} ${val(flowOf(s, id), s)}`, true) + iconOf(id)));
  const rightPad = Math.min(lastNatural, g.w * 0.24) + 14, leftPad = 4;
  const plotL = g.x + leftPad, plotR = g.x + g.w - rightPad;
  const step = L > 1 ? (plotR - nodeW - plotL) / (L - 1) : 0;
  if (L > 1 && step < nodeW + 60) fail('sankey', `${L} layers do not fit in ${Math.round(g.w)}px (raise width, or use fewer layers)`);
  const labelW = (li: number) => li === L - 1 ? rightPad - 14 : step - nodeW - 16;
  // a node's label: name (wrapped) over the value, or on one line when it fits
  const labels = new Map<string, string[]>();
  for (const n of s.nodes) {
    const li = layer.get(n.id)!, full = `${n.label} ${val(flowOf(s, n.id), s)}`, w = labelW(li) - iconOf(n.id);
    const one = c.tw(full, true) <= w ? [full] : [...c.wrap(n.label, w, true), val(flowOf(s, n.id), s)];
    for (const l of one) if (c.tw(l, true) > w + 1) fail('sankey', `the label "${l}" does not fit between the layers (shorten it, or raise width)`);
    labels.set(n.id, one);
  }
  const gap = Math.max(10, S * 0.8), minH = (id: string) => labels.get(id)!.length * lh + 4;
  const maxCount = Math.max(...cols.map(c2 => c2.length));
  const H = (g.height ?? Math.max(300, 46 * maxCount + 120)) - 8;
  c.h = H + 8;
  const fits = (sc: number): boolean => cols.every(col => col.reduce((a, id) => a + Math.max(flowOf(s, id) * sc, minH(id)), 0) + (col.length - 1) * gap <= H);
  let lo = 0, hi = H / Math.min(...s.nodes.map(n => flowOf(s, n.id))) + 1;
  if (!fits(0)) fail('sankey', `a layer has too many nodes for ${H}px (raise height, or fewer nodes)`);
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  const sc = lo * 0.999;
  const slot = (id: string) => Math.max(flowOf(s, id) * sc, minH(id));
  const geo = new Map<string, {x: number; y: number; h: number}>();
  cols.forEach((col, li) => {
    const used = col.reduce((a, id) => a + slot(id), 0) + (col.length - 1) * gap;
    let y = g.y + 4 + (H - used) / 2;
    for (const id of col) { const nh = Math.max(2, flowOf(s, id) * sc); geo.set(id, {x: plotL + li * step, y: y + (slot(id) - nh) / 2, h: nh}); y += slot(id) + gap; }
  });
  // ribbons first (under everything): out-links stack down a node's right edge in the order of their targets, in-links down its left edge
  const centre = (id: string) => geo.get(id)!.y + geo.get(id)!.h / 2;
  const outOff = new Map<string, number>(), inOff = new Map<string, number>(), outAt = new Map<string, number>(), inAt = new Map<string, number>();
  for (const l of [...s.links].sort((a, b) => centre(a.to) - centre(b.to))) { outOff.set(`${l.from}>${l.to}`, outAt.get(l.from) ?? 0); outAt.set(l.from, (outAt.get(l.from) ?? 0) + l.value * sc); }
  for (const l of [...s.links].sort((a, b) => centre(a.from) - centre(b.from))) { inOff.set(`${l.from}>${l.to}`, inAt.get(l.to) ?? 0); inAt.set(l.to, (inAt.get(l.to) ?? 0) + l.value * sc); }
  const ribbons = s.links.map(l => {
    const a = geo.get(l.from)!, b = geo.get(l.to)!, t = l.value * sc, k = `${l.from}>${l.to}`;
    const x0 = a.x + nodeW, x1 = b.x, y0 = a.y + outOff.get(k)!, y1 = b.y + inOff.get(k)!, xm = (x0 + x1) / 2;
    return {l, t, x0, x1, y0, y1, xm};
  });
  for (const r of ribbons) {
    const p = (v: number) => r1(v);
    const d = `M${p(r.x0)},${p(r.y0)} C${p(r.xm)},${p(r.y0)} ${p(r.xm)},${p(r.y1)} ${p(r.x1)},${p(r.y1)} L${p(r.x1)},${p(r.y1 + r.t)} C${p(r.xm)},${p(r.y1 + r.t)} ${p(r.xm)},${p(r.y0 + r.t)} ${p(r.x0)},${p(r.y0 + r.t)} Z`;
    c.path(d, {of: [r.l.from, r.l.to], fill: r.l.tone === 'accent' ? 'accent' : r.l.tone, op: 0.22, ...(r.l.tone === 'danger' ? {stroke: 'danger' as const, sw: 2, dash: '6,4'} : {})});
  }
  // nodes, then their labels
  for (const n of s.nodes) {
    const q = geo.get(n.id)!, li = layer.get(n.id)!;
    c.rect(r1(q.x), r1(q.y), nodeW, r1(q.h), {fill: n.tone, id: n.id, of: n.id, solid: n.id});
    const ls = labels.get(n.id)!, cy = q.y + q.h / 2;
    if (n.icon) c.icon(n.icon.glyph, n.icon.name, q.x + nodeW + 8, cy - lh / 2 + 1, lh - 2, 'text', n.id);
    c.lines(ls.length > 1 ? ls.map(t => t) : ls, q.x + nodeW + 8 + iconOf(n.id), cy - (ls.length - 1) * lh / 2 + S * 0.36, 'start', 'text', {bold: ls.length === 1, of: n.id, plate: true});
    void li;
  }
  // the value on a ribbon, in the middle of its run, when it is thick enough and there is room
  if (s.linkLabels) for (const r of ribbons) {
    const text = val(r.l.value, s), cy = (r.y0 + r.y1) / 2 + r.t / 2;
    // a value that is the whole of either end is already on that node's label
    if (Math.abs(flowOf(s, r.l.from) - r.l.value) < 1e-9 || Math.abs(flowOf(s, r.l.to) - r.l.value) < 1e-9) continue;
    if (r.t < S + 6) { c.omitted.push(`${nameOf(r.l.from).label} → ${nameOf(r.l.to).label} ${text}`); continue; }
    if (!c.place(text, [{x: r.xm, y: c.mid(cy), anchor: 'middle'}], 'text', {bold: true, plate: true})) c.omitted.push(`${nameOf(r.l.from).label} → ${nameOf(r.l.to).label} ${text}`);
  }
  return c.done();
}
