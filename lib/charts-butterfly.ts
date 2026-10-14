// butterfly(): a two-sided bar chart. Each row is one item; its two bars grow outwards from a column of names in the middle, one to the
// left and one to the right, on the same scale — so the eye compares the two groups item by item (us vs a rival, before vs after).
import {Canvas, checkIds, checkText, fail, finiteNum, numText} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';

export interface ButterflyRow {
  label: string;
  /** The value of the left group (>= 0). */
  left: number;
  /** The value of the right group (>= 0). */
  right: number;
  id?: string;
}
export interface ButterflyOpts extends ChartOpts {
  /** The names of the two groups, written over their halves. Required: the chart cannot be read without them. */
  leftLabel: string;
  rightLabel: string;
  unit?: string;
  /** Order of the rows: 'given' (default), or by the size of 'left' / 'right' (largest first). */
  sort?: 'given' | 'left' | 'right';
  /** Colours of the two sides (default text / accent). */
  leftTone?: ChartTone;
  rightTone?: ChartTone;
}
export interface ButterflySpec {rows: ButterflyRow[]; leftLabel: string; rightLabel: string; unit: string; leftTone: ChartTone; rightTone: ChartTone}

export function resolveButterfly(rows: readonly ButterflyRow[], opts: ButterflyOpts): ButterflySpec {
  if (!Array.isArray(rows) || rows.length === 0) fail('butterfly', 'needs at least one row');
  if (rows.length > 20) fail('butterfly', `${rows.length} rows are too many for one figure (at most 20)`);
  if (opts?.leftLabel === undefined || opts?.rightLabel === undefined) fail('butterfly', 'needs the names of both groups: butterfly(rows, {leftLabel: "自社", rightLabel: "競合"})');
  checkIds('butterfly', rows.map(r => r.id), opts.id);
  const list = rows.map((r, k) => ({label: checkText('butterfly', `row ${k + 1}'s label`, r.label), left: finiteNum('butterfly', `"${r.label}" left`, r.left, {min: 0}), right: finiteNum('butterfly', `"${r.label}" right`, r.right, {min: 0}), ...(r.id === undefined ? {} : {id: r.id})}));
  if (new Set(list.map(r => r.label)).size !== list.length) fail('butterfly', 'each row needs its own label');
  if (list.every(r => r.left === 0 && r.right === 0)) fail('butterfly', 'all values are 0');
  const sort = opts.sort ?? 'given';
  if (!['given', 'left', 'right'].includes(sort)) fail('butterfly', `sort must be given, left or right (got ${String(sort)})`);
  const ordered = sort === 'given' ? list : [...list].sort((a, b) => b[sort] - a[sort] || list.indexOf(a) - list.indexOf(b));
  const tones = ['accent', 'danger', 'muted', 'text'];
  for (const k of ['leftTone', 'rightTone'] as const) if (opts[k] !== undefined && !tones.includes(opts[k] as string)) fail('butterfly', `${k} must be accent, danger, muted or text`);
  return {rows: ordered, leftLabel: checkText('butterfly', 'leftLabel', opts.leftLabel), rightLabel: checkText('butterfly', 'rightLabel', opts.rightLabel), unit: opts.unit ?? '', leftTone: opts.leftTone ?? 'text', rightTone: opts.rightTone ?? 'accent'};
}
export function butterflyAlt(s: ButterflySpec): string {
  return `バタフライチャート（左: ${s.leftLabel}、右: ${s.rightLabel}）: ${s.rows.map(r => `${r.label} ${numText(r.left)}${s.unit} 対 ${numText(r.right)}${s.unit}`).join('、')}`;
}
export function butterflyTexts(s: ButterflySpec): [string, number][] {
  const out: [string, number][] = [[s.leftLabel, 700], [s.rightLabel, 700]];
  for (const r of s.rows) out.push([r.label, 400], [`${numText(r.left)}${s.unit}`, 700], [`${numText(r.right)}${s.unit}`, 700]);
  return out;
}

export function layoutButterfly(s: ButterflySpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf), lineH = c.lineH(), r1 = (v: number) => Math.round(v * 10) / 10;
  const vText = (v: number) => `${numText(v)}${s.unit}`;
  const valW = Math.max(...s.rows.flatMap(r => [c.tw(vText(r.left), true), c.tw(vText(r.right), true)])) + 10;
  const labelW = Math.min(Math.max(...s.rows.map(r => c.tw(r.label))) + 24, g.w * 0.3);
  const plotW = (g.w - labelW) / 2 - valW - 4;
  if (plotW < 70) fail('butterfly', 'the figure is too narrow for its labels (raise width, or shorten the labels / unit)');
  const innerL = g.x + valW + 4 + plotW, innerR = innerL + labelW, outerL = g.x + valW + 4, outerR = innerR + plotW;
  const max = Math.max(...s.rows.flatMap(r => [r.left, r.right]));
  const barH = Math.max(24, S + 10), wrapped = s.rows.map(r => c.wrap(r.label, labelW - 16));
  const rowH = wrapped.map(l => Math.max(barH + 12, l.length * lineH + 8));
  const headH = S + 18, y0 = g.y + headH;
  c.h = g.height ?? headH + rowH.reduce((a, b) => a + b, 0) + 4;
  if (g.height !== undefined && g.height < headH + rowH.reduce((a, b) => a + b, 0)) fail('butterfly', `height ${g.height} is too small for ${s.rows.length} rows (need at least ${headH + rowH.reduce((a, b) => a + b, 0)})`);
  const bodyB = y0 + rowH.reduce((a, b) => a + b, 0);
  // the names of the two groups over their halves, with a swatch so the colour is tied to the name
  const sw = 14;
  ([[s.leftLabel, s.leftTone, outerL, innerL], [s.rightLabel, s.rightTone, innerR, outerR]] as const).forEach(([name, tone, a, b]) => {
    const need = sw + 6 + c.tw(name, true);
    if (need > b - a + valW) fail('butterfly', `the group name "${name}" is wider than its half (shorten it, or raise width)`);
    const x = r1((a + b) / 2 - need / 2), cy = g.y + Math.max(4 + sw / 2, Math.ceil(S * 0.64));
    c.rect(x, cy - sw / 2, sw, sw, {fill: tone});
    c.text(name, x + sw + 6, c.mid(cy), 'start', 'text', {bold: true});
  });
  // the two spines the bars grow from
  c.line(r1(innerL), y0, r1(innerL), bodyB, {stroke: 'border'});
  c.line(r1(innerR), y0, r1(innerR), bodyB, {stroke: 'border'});
  let y = y0;
  s.rows.forEach((row, k) => {
    const cy = y + rowH[k] / 2, top = cy - barH / 2, key = row.id ?? `#${k}`;
    c.lines(wrapped[k], (innerL + innerR) / 2, cy - (wrapped[k].length - 1) * lineH / 2 + S * 0.36, 'middle', 'text', {of: key});
    const sides = [
      {v: row.left, tone: s.leftTone, name: s.leftLabel, x1: innerL - row.left / max * plotW, x2: innerL, out: 'end' as const},
      {v: row.right, tone: s.rightTone, name: s.rightLabel, x1: innerR, x2: innerR + row.right / max * plotW, out: 'start' as const},
    ];
    for (const b of sides) {
      const w = b.x2 - b.x1;
      if (w >= 1) c.rect(r1(b.x1), r1(top), r1(w), barH, {fill: b.tone, solid: `${row.label} ${b.name}`, of: key});
      const text = vText(b.v), tx = b.out === 'end' ? b.x1 - 6 : b.x2 + 6;
      if (!c.place(text, [{x: b.out === 'end' ? (w >= 1 ? tx : innerL - 6) : (w >= 1 ? tx : innerR + 6), y: c.mid(cy), anchor: b.out}], b.tone === 'muted' ? 'text' : b.tone, {bold: true, of: key})) fail('butterfly', `the value "${text}" of "${row.label}" has no room`);
    }
    if (row.id) c.anchors.push({id: row.id, x: r1(sides[0].x1), y: r1(top), w: r1(sides[1].x2 - sides[0].x1), h: barH});
    y += rowH[k];
  });
  return c.done();
}
