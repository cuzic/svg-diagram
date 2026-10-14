// treemap(): a tree of values as nested rectangles, the area of each proportional to its value (squarified, so cells stay close to square).
// Every cell prints its name and value when they fit; a cell too small for them is drawn without a label and listed in the description
// (strict: true makes it an error instead).
import {Canvas, checkIds, checkText, fail, finiteNum, inkOnShade, numText} from './charts-base.ts';
import type {ColorKey} from './types/core.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';

export interface TreemapNode {
  label: string;
  /** A leaf's value (the area). A group takes the sum of its children. */
  value?: number;
  children?: TreemapNode[];
  id?: string;
  /** A leaf in a solid colour to stand out (default: the pale shade of its group). */
  tone?: Extract<ChartTone, 'accent' | 'danger'>;
}
export interface TreemapOpts extends ChartOpts {
  unit?: string;
  /** Add each cell's share of the whole to its value ("120 (12%)"). */
  percent?: boolean;
  /** A label that does not fit is an error instead of being left out of the drawing. */
  strict?: boolean;
}
export interface TreemapSpec {nodes: TreemapNode[]; unit: string; percent: boolean; strict: boolean; total: number}

const totalOf = (n: TreemapNode): number => n.children?.length ? n.children.reduce((a, c) => a + totalOf(c), 0) : n.value ?? 0;
export function resolveTreemap(tree: TreemapNode | readonly TreemapNode[], opts: TreemapOpts): TreemapSpec {
  const nodes = Array.isArray(tree) ? [...tree as TreemapNode[]] : [tree as TreemapNode];
  if (!nodes.length || !nodes[0]) fail('treemap', 'needs at least one node');
  const ids: (string | undefined)[] = [];
  const walk = (n: TreemapNode, depth: number, where: string): TreemapNode => {
    checkText('treemap', `${where}'s label`, n.label);
    if (depth > 4) fail('treemap', `"${n.label}" is nested more than 4 levels deep`);
    ids.push(n.id);
    if (n.children?.length) {
      if (n.value !== undefined) { const t = totalOf({...n, value: undefined}); if (Math.abs(finiteNum('treemap', `"${n.label}" value`, n.value) - t) > 1e-9 * Math.max(1, t)) fail('treemap', `"${n.label}" is ${n.value} but its children add up to ${numText(parseFloat(t.toPrecision(12)))} (leave its value out)`); }
      if (n.tone !== undefined) fail('treemap', `"${n.label}": a group takes no tone (set it on a leaf)`);
      return {label: n.label, children: n.children.map((c, i) => walk(c, depth + 1, `"${n.label}" child ${i + 1}`)), ...(n.id === undefined ? {} : {id: n.id})};
    }
    const v = finiteNum('treemap', `"${n.label}" value`, n.value, {min: 0});
    if (n.tone !== undefined && !['accent', 'danger'].includes(n.tone)) fail('treemap', `"${n.label}": tone must be accent or danger`);
    return {label: n.label, value: v, ...(n.tone === undefined ? {} : {tone: n.tone}), ...(n.id === undefined ? {} : {id: n.id})};
  };
  const out = nodes.map((n, i) => walk(n, 1, `node ${i + 1}`));
  checkIds('treemap', ids, opts.id);
  const total = out.reduce((a, n) => a + totalOf(n), 0);
  if (!(total > 0)) fail('treemap', 'every value is 0');
  return {nodes: out, unit: opts.unit ?? '', percent: !!opts.percent, strict: !!opts.strict, total};
}
const share = (v: number, total: number): string => `${numText(Math.round(v / total * 1000) / 10)}%`;
const valueText = (v: number, s: TreemapSpec): string => `${numText(parseFloat(v.toPrecision(12)))}${s.unit}${s.percent ? ` (${share(v, s.total)})` : ''}`;
export function treemapAlt(s: TreemapSpec): string {
  const line = (n: TreemapNode): string => n.children?.length ? `${n.label}（計 ${valueText(totalOf(n), s)}）: ${n.children.map(line).join('、')}` : `${n.label} ${valueText(n.value ?? 0, s)}`;
  return `ツリーマップ（全体 ${valueText(s.total, s)}）: ${s.nodes.map(line).join('、')}`;
}
export function treemapTexts(s: TreemapSpec): [string, number][] {
  const out: [string, number][] = [];
  const walk = (n: TreemapNode): void => {
    out.push([n.label, 400], [n.label, 700], [valueText(totalOf(n), s), 700], [valueText(totalOf(n), s), 400], [`${n.label} ${valueText(totalOf(n), s)}`, 400], [`${n.label} ${valueText(totalOf(n), s)}`, 700]);
    n.children?.forEach(walk);
  };
  s.nodes.forEach(walk);
  return out;
}

interface Cell {n: TreemapNode; v: number; x: number; y: number; w: number; h: number}
/** Squarified layout (Bruls, Huizing, van Wijk): items sorted by value, laid in rows along the shorter side. */
export function squarify(items: {n: TreemapNode; v: number}[], x: number, y: number, w: number, h: number): Cell[] {
  const list = items.filter(i => i.v > 0).sort((a, b) => b.v - a.v);
  const sum = list.reduce((a, b) => a + b.v, 0), out: Cell[] = [];
  if (!list.length || !(w > 0) || !(h > 0)) return out;
  const scale = w * h / sum, areas = list.map(i => i.v * scale);
  let i = 0, rx = x, ry = y, rw = w, rh = h;
  const worst = (row: number[], side: number): number => { const s = row.reduce((a, b) => a + b, 0), mx = Math.max(...row), mn = Math.min(...row); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
  while (i < list.length) {
    const side = Math.min(rw, rh), row: number[] = [areas[i]];
    let j = i + 1;
    while (j < list.length && worst([...row, areas[j]], side) <= worst(row, side)) { row.push(areas[j]); j++; }
    const rs = row.reduce((a, b) => a + b, 0), thick = rs / side;
    let off = 0;
    for (let k = i; k < j; k++) {
      const len = areas[k] / thick;
      if (rw >= rh) out.push({n: list[k].n, v: list[k].v, x: rx, y: ry + off, w: thick, h: len}); else out.push({n: list[k].n, v: list[k].v, x: rx + off, y: ry, w: len, h: thick});
      off += len;
    }
    if (rw >= rh) { rx += thick; rw -= thick; } else { ry += thick; rh -= thick; }
    i = j;
  }
  return out;
}

/** What the layout decides for one node, before anything is drawn. */
type Placed =
  | {k: 'leaf'; n: TreemapNode; gi: number; x: number; y: number; w: number; h: number}
  | {k: 'group'; n: TreemapNode; gi: number; x: number; y: number; w: number; h: number; head: 'full' | 'name' | 'none'}
  | {k: 'gone'; n: TreemapNode};

export function layoutTreemap(s: TreemapSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, h = g.height ?? Math.round(Math.min(480, Math.max(300, g.w * 0.5)));
  const c = new Canvas(g.x, g.y, g.w, h, S, g.widthOf), lh = c.lineH(), r1 = (v: number) => Math.round(v * 10) / 10;
  const headH = S + 10;
  // Where every node goes for given weights. A group's frame and header strip take room from its children, so with the values as
  // weights a leaf inside a group gets less area per unit than one outside it; the weights are corrected below until the drawn
  // area of every leaf is proportional to its value.
  const plan = (weight: Map<TreemapNode, number>): Placed[] => {
    const out: Placed[] = [];
    const wOf = (n: TreemapNode): number => n.children?.length ? n.children.reduce((a, k) => a + wOf(k), 0) : weight.get(n) ?? 0;
    const lay = (n: TreemapNode, cell: {x: number; y: number; w: number; h: number}, gi: number): void => {
      if (!n.children?.length) {
        const x = r1(cell.x + 1), y = r1(cell.y + 1), w = r1(cell.w - 2), hh = r1(cell.h - 2);
        out.push(w <= 0 || hh <= 0 ? {k: 'gone', n} : {k: 'leaf', n, gi, x, y, w, h: hh});
        return;
      }
      const x = cell.x + 2, y = cell.y + 2, w = cell.w - 4, hh = cell.h - 4;
      if (w <= 0 || hh <= 0) { out.push({k: 'gone', n}); return; }
      const text = `${n.label} ${valueText(totalOf(n), s)}`;
      const head = hh > headH + 24 && c.tw(text, true) <= w - 10 ? 'full' : hh > headH + 24 && c.tw(n.label, true) <= w - 10 ? 'name' : 'none';
      out.push({k: 'group', n, gi, x, y, w, h: hh, head});
      const inner = head === 'none' ? {x: x + 3, y: y + 3, w: w - 6, h: hh - 6} : {x: x + 3, y: y + headH + 5, w: w - 6, h: hh - headH - 8};
      for (const k of squarify(n.children.map(k => ({n: k, v: wOf(k)})), inner.x, inner.y, inner.w, inner.h)) lay(k.n, k, gi);
      for (const k of n.children) if (wOf(k) === 0) out.push({k: 'gone', n: k});
    };
    if (s.nodes.length > 1) {
      squarify(s.nodes.map(n => ({n, v: wOf(n)})), g.x, g.y, g.w, h).forEach((r, i) => lay(r.n, r, i));
      for (const n of s.nodes) if (wOf(n) === 0) out.push({k: 'gone', n});
    }
    else lay(s.nodes[0], {x: g.x, y: g.y, w: g.w, h}, 0);
    return out;
  };
  const leaves: TreemapNode[] = [];
  const collect = (n: TreemapNode): void => { if (n.children?.length) n.children.forEach(collect); else if ((n.value ?? 0) > 0) leaves.push(n); };
  s.nodes.forEach(collect);
  const weight = new Map(leaves.map(n => [n, n.value as number]));
  // the worst ratio of drawn area per unit of value, over the best (1: every leaf exactly proportional)
  const spread = (p: Placed[]): number => { const r = p.flatMap(q => q.k === 'leaf' && (q.n.value ?? 0) > 0 ? [q.w * q.h / (q.n.value as number)] : []); return r.length ? Math.max(...r) / Math.min(...r) : 1; };
  let placed = plan(weight), best = {placed, err: spread(placed)};
  for (let it = 0; it < 12 && best.err > 1.01; it++) {
    const drawn = new Map<TreemapNode, number>();
    for (const q of placed) if (q.k === 'leaf') drawn.set(q.n, q.w * q.h);
    const area = leaves.reduce((a, n) => a + (drawn.get(n) ?? 0), 0), value = leaves.reduce((a, n) => a + (n.value as number), 0);
    if (!(area > 0)) break;
    // the area each leaf should have, at the figure's area per unit; a leaf drawn too small gets more weight (one that vanished: double)
    for (const n of leaves) { const want = (n.value as number) * area / value, got = drawn.get(n) ?? 0; weight.set(n, weight.get(n)! * (got > 0 ? want / got : 2)); }
    placed = plan(weight);
    const err = spread(placed);
    if (err < best.err - 1e-9) best = {placed, err};
  }
  placed = best.placed;

  const small: string[] = [];
  const shadeOf = (gi: number): number => [0.1, 0.2, 0.3][gi % 3];
  const label = (cell: {n: TreemapNode; x: number; y: number; w: number; h: number}, host: number, ink: ColorKey, on: {fill: 'accent' | 'danger'; op?: number; ink: ColorKey}, id?: string): boolean => {
    const n = cell.n, val = valueText(n.value ?? 0, s), inner = {w: cell.w - 10, h: cell.h - 6};
    // name above value; the value wrapped too when the cell is narrow; both on one line; the value alone
    const nameLs = c.wrap(n.label, inner.w, true), valLs = c.wrap(val, inner.w, true);
    const tries: {t: string; bold: boolean}[][] = [
      [...nameLs.map(t => ({t, bold: false})), {t: val, bold: true}],
      [...nameLs.map(t => ({t, bold: false})), ...valLs.map(t => ({t, bold: true}))],
      [{t: `${n.label} ${val}`, bold: false}],
      valLs.map(t => ({t, bold: true})),
    ];
    for (const ls of tries) {
      if (ls.length * lh + 4 > inner.h || ls.some(l => c.tw(l.t, l.bold) > inner.w)) continue;
      const base = cell.y + (cell.h - ls.length * lh) / 2 + S;
      ls.forEach((l, k) => c.text(l.t, cell.x + cell.w / 2, base + k * lh, 'middle', ink, {bold: l.bold, host, on, of: id}));
      return true;
    }
    return false;
  };
  let leafNo = 0;
  for (const q of placed) {
    const n = q.n;
    if (q.k === 'gone') { small.push(`${n.label} ${valueText(totalOf(n), s)}`); continue; }
    if (q.k === 'leaf') {
      const id = n.id, key = id ?? `#${leafNo++}`, solidTone = n.tone, op = solidTone ? undefined : shadeOf(q.gi);
      const host = c.rect(q.x, q.y, q.w, q.h, {fill: solidTone ?? 'accent', ...(op === undefined ? {} : {op}), id, of: key, solid: id ?? `cell "${n.label}"`});
      const ink = solidTone ? 'bg' as const : inkOnShade(op!);
      if (!label(q, host, ink, {fill: solidTone ?? 'accent', ...(op === undefined ? {} : {op}), ink}, key)) small.push(`${n.label} ${valueText(n.value ?? 0, s)}`);
      continue;
    }
    c.rect(r1(q.x), r1(q.y), r1(q.w), r1(q.h), {fill: 'bg', stroke: 'border', sw: 2, id: n.id, of: n.id});
    // the group's own label sits in a strip along the top of its frame
    if (q.head !== 'none') {
      const host = c.rect(r1(q.x + 2), r1(q.y + 2), r1(q.w - 4), headH, {fill: 'code', solid: `header of "${n.label}"`, of: n.id});
      c.text(q.head === 'full' ? `${n.label} ${valueText(totalOf(n), s)}` : n.label, q.x + 8, c.mid(q.y + 2 + headH / 2), 'start', 'text', {bold: true, host, of: n.id});
    }
    if (q.head !== 'full') small.push(`${n.label} ${valueText(totalOf(n), s)}`);
  }
  if (s.strict && small.length) fail('treemap', `${small.length} label${small.length > 1 ? 's do' : ' does'} not fit (${small.slice(0, 3).join(', ')}${small.length > 3 ? ', ...' : ''}): raise width / height, or drop strict`);
  c.omitted.push(...small);
  return c.done();
}
