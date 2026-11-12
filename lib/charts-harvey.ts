// harvey(): a table of Harvey balls (ハーベイボール): each cell is a circle filled by a quarter, a half, three quarters or fully, the
// usual way a consulting slide rates options against criteria. The fill is a shape (a wedge), never just a colour, and the scale is
// written under the table; the values are listed in the description.
import {must} from './must.ts';
import {checkIds, checkText, fail, finiteNum} from './charts-base.ts';
import type {Canvas, ChartGeom, ChartOpts, LaidOutChartPart} from './charts-base.ts';
import {layoutRatingTable} from './charts-rating-table.ts';

/** A row: its name, or its name with an id (a connect() / spotlight target for the whole row). */
export type HarveyRow = string | {label: string; id?: string};
/** A cell: the quarters filled (0-4), null when it is not rated, or [quarters, note] to write the reason beside the ball. */
export type HarveyCell = number | null | readonly [quarters: number, note: string];
export interface HarveyOpts extends ChartOpts {
  /** The name of the five steps, from empty (0) to full (4), written in the legend. Default なし / 一部 / 半分 / ほぼ / 十分. */
  levels?: readonly [string, string, string, string, string];
  /** The text in the top left corner (over the row names). */
  corner?: string;
  /** Column names to stress (their header is bold and the column is boxed). */
  highlight?: readonly string[];
}
export interface HarveySpec {rows: string[]; rowIds: (string | undefined)[]; cols: string[]; values: (number | null)[][]; /** The note of each cell, '' for none. */ notes: string[][]; levels: string[]; corner: string; highlight: string[]}

export function resolveHarvey(rowsIn: readonly HarveyRow[], cols: readonly string[], values: readonly (readonly HarveyCell[])[], opts: HarveyOpts = {}): HarveySpec {
  if (!Array.isArray(rowsIn) || rowsIn.length === 0) fail('harvey', 'needs at least one row');
  const rows = rowsIn.map(r => typeof r === 'string' ? r : r.label), rowIds = rowsIn.map(r => typeof r === 'string' ? undefined : r.id);
  checkIds('harvey', rowIds, opts.id);
  if (!Array.isArray(cols) || cols.length === 0) fail('harvey', 'needs at least one column');
  if (rows.length > 20 || cols.length > 10) fail('harvey', 'is limited to 20 rows and 10 columns (it is a table of symbols to read at a glance)');
  rows.forEach((r, i) => checkText('harvey', `row ${i + 1}`, r));
  cols.forEach((r, i) => checkText('harvey', `column ${i + 1}`, r));
  if (new Set(rows).size !== rows.length || new Set(cols).size !== cols.length) fail('harvey', 'row names and column names must each be unique');
  if (!Array.isArray(values) || values.length !== rows.length) fail('harvey', `values needs ${rows.length} rows (one per row name), got ${Array.isArray(values) ? values.length : 'none'}`);
  const notes = rows.map(() => cols.map(() => ''));
  const grid = values.map((r, i) => {
    if (!Array.isArray(r) || r.length !== cols.length) fail('harvey', `row "${rows[i]}" needs ${cols.length} values (one per column), got ${Array.isArray(r) ? r.length : 'none'}`);
    return r.map((cell: HarveyCell, j: number) => {
      const where = `"${rows[i]}" / "${cols[j]}"`;
      const v = Array.isArray(cell) ? cell[0] as number : cell as number | null;
      if (Array.isArray(cell)) {
        if (cell.length !== 2 || cell[0] === null) fail('harvey', `${where} must be a number, null or [quarters, note] (a cell that is not rated has no note)`);
        must(notes[i])[j] = checkText('harvey', `the note of ${where}`, cell[1]);
      }
      if (v === null) return null;
      finiteNum('harvey', where, v);
      if (![0, 1, 2, 3, 4].includes(v)) fail('harvey', `${where} must be 0, 1, 2, 3 or 4 (quarters filled; null for not rated), got ${v}`);
      return v;
    });
  });
  const levels = opts.levels === undefined ? ['なし', '一部', '半分', 'ほぼ', '十分'] : [...opts.levels];
  if (levels.length !== 5) fail('harvey', 'levels needs 5 names, from empty to full');
  levels.forEach((l, i) => checkText('harvey', `levels[${i}]`, l));
  for (const h of opts.highlight ?? []) if (!cols.includes(h)) fail('harvey', `highlight "${h}" is not a column name`);
  return {rows, rowIds, cols: [...cols], values: grid, notes, levels, corner: opts.corner ?? '', highlight: [...(opts.highlight ?? [])]};
}
export function harveyAlt(s: HarveySpec): string {
  return `ハーベイボール（${s.levels.map((l, i) => `${i}/4 = ${l}`).join('、')}）: ${s.rows.map((r, i) => `${r}: ${s.cols.map((c, j) => `${c} ${must(s.values[i])[j] === null ? '未評価' : must(s.levels[must(must(s.values[i])[j])])}${must(s.notes[i])[j] ? `（${must(s.notes[i])[j]}）` : ''}`).join('、')}`).join(' / ')}`;
}
export function harveyTexts(s: HarveySpec): [string, number][] {
  const out: [string, number][] = [];
  for (const r of s.rows) out.push([r, 400], [r, 700]);
  for (const c of s.cols) out.push([c, 400], [c, 700]);
  if (s.corner) out.push([s.corner, 400]);
  out.push(['—', 400], ['未評価', 400]);
  for (const l of s.levels) out.push([l, 400]);
  for (const n of s.notes.flat()) if (n) out.push([n, 400]);
  return out;
}

/** The path of a Harvey ball's filled part: `q` quarters, from 12 o'clock clockwise. */
export function harveyWedge(cx: number, cy: number, r: number, q: number): string {
  const f = (v: number) => Math.round(v * 10) / 10;
  if (q <= 0) return '';
  if (q >= 4) return `M${f(cx - r)},${f(cy)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
  const a = q * Math.PI / 2, x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
  return `M${f(cx)},${f(cy)} L${f(cx)},${f(cy - r)} A${r},${r} 0 ${q > 2 ? 1 : 0},1 ${f(x)},${f(y)} Z`;
}

export function layoutHarvey(s: HarveySpec, g: ChartGeom): LaidOutChartPart {
  const R = Math.max(12, Math.ceil(g.size * 0.9));
  const cells = s.values.map((r, i) => r.map((v, j) => v === null ? null : {rating: v, note: must(s.notes[i])[j]}));
  return layoutRatingTable({rows: s.rows, rowIds: s.rowIds, cols: s.cols, cells, corner: s.corner, highlight: s.highlight, ruled: s.notes.flat().some(Boolean)}, {
    who: 'harvey', ratingW: 2 * R + 12, ratingH: 2 * R + 16,
    draw: (c, cx, cy, q, of) => ball(c, cx, cy, R, q, of),
    // legend: the five balls with their names, in a row (it fails when the width is short)
    foot: {h: 2 * R + 18, draw: (c, tableBottom) => {
      const lr = Math.round(R * 0.62), item = (t: string) => 2 * lr + 6 + c.tw(t), gap = 20, ly = tableBottom + 8 + lr + 4;
      let lx = g.x + 4;
      if (s.levels.reduce((a, t) => a + item(t) + gap, -gap) > g.w) fail('harvey', 'the legend does not fit (shorten the level names, or raise width)');
      s.levels.forEach((t, q) => { ball(c, lx + lr, ly, lr, q); c.text(t, lx + 2 * lr + 6, c.mid(ly), 'start', 'text'); lx += item(t) + gap; });
    }},
  }, g);
}
function ball(c: Canvas, cx: number, cy: number, r: number, q: number, of?: string): void {
  const f = (v: number) => Math.round(v * 10) / 10;
  c.path(`M${f(cx - r)},${f(cy)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`, {fill: 'bg', stroke: 'text', sw: 2, of});
  if (q > 0) c.path(harveyWedge(cx, cy, r, q), {fill: 'text', stroke: 'text', sw: 2, of});
}
