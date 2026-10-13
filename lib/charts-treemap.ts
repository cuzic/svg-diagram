// treemap(): a tree of values as nested rectangles, the area of each proportional to its value (squarified, so cells stay close to square).
// Every cell prints its name and value when they fit; a cell too small for them is drawn without a label and listed in the description
// (strict: true makes it an error instead).
import {Canvas, checkIds, checkText, fail, finiteNum, inkOnShade, numText} from './charts-base.ts';
import type {ColorKey} from './types.ts';
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
  checkIds('treemap()', ids, opts.id);
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

export function layoutTreemap(s: TreemapSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, h = g.height ?? Math.round(Math.min(480, Math.max(300, g.w * 0.5)));
  const c = new Canvas(g.x, g.y, g.w, h, S, g.widthOf), lh = c.lineH(), r1 = (v: number) => Math.round(v * 10) / 10;
  const top = s.nodes.length > 1 ? squarify(s.nodes.map(n => ({n, v: totalOf(n)})), g.x, g.y, g.w, h) : [];
  // one root alone is the figure itself; several roots are the top level
  const roots: Cell[] = s.nodes.length > 1 ? top : [{n: s.nodes[0], v: totalOf(s.nodes[0]), x: g.x, y: g.y, w: g.w, h}];
  const groupIndex = new Map<TreemapNode, number>();
  roots.forEach((r, i) => groupIndex.set(r.n, i));
  const small: string[] = [];
  const shadeOf = (gi: number): number => [0.1, 0.2, 0.3][gi % 3];
  const label = (cell: Cell, gi: number, host: number, ink: ColorKey, on: {fill: 'accent' | 'danger'; op?: number; ink: ColorKey}, id?: string): boolean => {
    const {n, v} = cell, val = valueText(v, s), inner = {w: cell.w - 10, h: cell.h - 6};
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
  const drawLeaf = (cell: Cell, gi: number): void => {
    const n = cell.n, id = n.id, key = id ?? `#${leafNo++}`, gap = 1;
    const x = r1(cell.x + gap), y = r1(cell.y + gap), w = r1(cell.w - 2 * gap), hh = r1(cell.h - 2 * gap);
    if (w <= 0 || hh <= 0) { small.push(`${n.label} ${valueText(cell.v, s)}`); return; }
    const solidTone = n.tone;
    const op = solidTone ? undefined : shadeOf(gi);
    const host = c.rect(x, y, w, hh, {fill: solidTone ?? 'accent', ...(op === undefined ? {} : {op}), id, of: key, solid: id ?? `cell "${n.label}"`});
    const ink = solidTone ? 'bg' as const : inkOnShade(op!);
    if (!label({...cell, x, y, w, h: hh}, gi, host, ink, {fill: solidTone ?? 'accent', ...(op === undefined ? {} : {op}), ink}, key)) small.push(`${n.label} ${valueText(cell.v, s)}`);
  };
  const lay = (cell: Cell, gi: number, depth: number): void => {
    const n = cell.n;
    if (!n.children?.length) { drawLeaf(cell, gi); return; }
    const gap = 2, x = cell.x + gap, y = cell.y + gap, w = cell.w - 2 * gap, hh = cell.h - 2 * gap;
    if (w <= 0 || hh <= 0) { small.push(`${n.label} ${valueText(cell.v, s)}`); return; }
    c.rect(r1(x), r1(y), r1(w), r1(hh), {fill: 'bg', stroke: 'border', sw: 2, id: n.id, of: n.id});
    // the group's own label sits in a strip along the top of its frame
    const headH = S + 10, text = `${n.label} ${valueText(cell.v, s)}`;
    const fits = hh > headH + 24 && c.tw(text, true) <= w - 10;
    const fitsName = hh > headH + 24 && c.tw(n.label, true) <= w - 10;
    let inner = {x: x + 3, y: y + 3, w: w - 6, h: hh - 6};
    if (fits || fitsName) {
      const host = c.rect(r1(x + 2), r1(y + 2), r1(w - 4), headH, {fill: 'code', solid: `header of "${n.label}"`, of: n.id});
      c.text(fits ? text : n.label, x + 8, c.mid(y + 2 + headH / 2), 'start', 'text', {bold: true, host, of: n.id});
      if (!fits) small.push(`${n.label} ${valueText(cell.v, s)}`);
      inner = {x: x + 3, y: y + headH + 5, w: w - 6, h: hh - headH - 8};
    } else small.push(`${n.label} ${valueText(cell.v, s)}`);
    const kids = squarify(n.children.map(k => ({n: k, v: totalOf(k)})), inner.x, inner.y, inner.w, inner.h);
    for (const k of n.children) if (totalOf(k) === 0) small.push(`${k.label} ${valueText(0, s)}`);
    for (const k of kids) lay(k, gi, depth + 1);
  };
  roots.forEach((r, i) => lay(r, i, 1));
  if (s.strict && small.length) fail('treemap', `${small.length} label${small.length > 1 ? 's do' : ' does'} not fit (${small.slice(0, 3).join(', ')}${small.length > 3 ? ', ...' : ''}): raise width / height, or drop strict`);
  c.omitted.push(...small);
  void inkOnShade;
  return c.done();
}
