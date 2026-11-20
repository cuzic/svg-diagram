// The table harvey() and compare() both draw: criteria as rows, options as columns, a rating in every cell and, when the table is `ruled`,
// a note beside it behind a dashed line. A band says what a rating looks like (`RatingLook`); everything else is here.
import {partStep} from './parts.ts';
import {must} from './must.ts';
import {Canvas, fail} from './charts-base.ts';
import type {ChartGeom, ChartTable, LaidOutChartPart, TableCell, TableRule} from './charts-base.ts';
import type {ColorKey} from './types/core.ts';

/** A rated cell (the note is drawn only in a ruled table), or null for a cell that is not rated (drawn as a dash). */
export type RatedCell<T> = {rating: T; note?: string} | null;
export interface RatingTable<T> {
  rows: string[];
  rowIds?: (string | undefined)[];
  cols: string[];
  cells: RatedCell<T>[][];
  corner: string;
  highlight?: string[];
  /** Tinted header, lines between the columns, and each cell split into its rating and its note. */
  ruled: boolean;
}
export interface RatingLook<T> {
  who: string;
  /** The room a rating takes: its column in a ruled table, and the narrowest a column may be in the others. */
  ratingW: number;
  ratingH: number;
  draw(c: Canvas, cx: number, cy: number, rating: T, of: string): void;
  /** The rating as the text of its table cell, when it is one (a mark): `draw` then draws it as the cell's text. Else it is drawn over the table. */
  cellText?(rating: T): {s: string; ink: ColorKey; bold?: boolean};
  /** What goes under the table (a legend). */
  foot?: {h: number; draw(c: Canvas, tableBottom: number): void};
}

export function layoutRatingTable<T>(t: RatingTable<T>, look: RatingLook<T>, g: ChartGeom): LaidOutChartPart {
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf, g.wrap), lh = c.lineH(), r1 = (v: number) => Math.round(v * 10) / 10, {who, ratingW} = look;
  const highlight = t.highlight ?? [], inset = t.ruled ? 8 : 4, boldHead = (k: string) => t.ruled || highlight.includes(k);
  // Kinsoku can leave a line one character past the width asked for (a small kana that may not start a line), so narrow the wrap until every line fits.
  const fit = (s: string, wrapW: number, limit: number, bold: boolean, what: string): string[] => {
    for (let w = wrapW; w > 0; w -= S / 2) { const ls = c.wrap(s, w, bold); if (ls.every(l => c.tw(l, bold) <= limit + 0.5)) return ls; }
    return fail(who, `${what} is too long for ${Math.round(limit)}px (shorten it, or raise width)`);
  };
  const rowW = Math.min(Math.max(...t.rows.map(r => c.tw(r)), t.corner ? c.tw(t.corner) : 0) + 16, g.w * (t.ruled ? 0.24 : 0.38));
  const colW = (g.w - rowW) / t.cols.length, noteW = colW - ratingW - 16;
  if (t.ruled ? noteW < S * 4 : colW < ratingW) fail(who, `${t.cols.length} columns do not fit in ${Math.round(g.w)}px (raise width, or use fewer columns)`);
  const heads = t.cols.map(k => fit(k, colW - 8, colW - 4, boldHead(k), `the column name "${k}"`));
  const names = t.rows.map(r => fit(r, rowW - 16, rowW - 8, false, `the row name "${r}"`));
  const corner = t.corner ? fit(t.corner, rowW - 8, rowW - 4, false, 'the corner text') : [];
  const notes = t.cells.map(r => r.map(cell => t.ruled && cell?.note ? fit(cell.note, noteW, noteW, false, `the note "${cell.note}"`) : []));
  const headH = Math.max(corner.length, ...heads.map(l => l.length)) * lh + 12;
  const rowH = t.rows.map((_r, i) => Math.max(look.ratingH, Math.max(must(names[i]).length, ...must(notes[i]).map(l => l.length)) * lh + (t.ruled ? 16 : 10)));
  const bodyT = g.y + headH, bodyB = bodyT + rowH.reduce((a, b) => a + b, 0), footH = look.foot?.h ?? 0;
  c.h = g.height ?? headH + (bodyB - bodyT) + (look.foot ? footH + 8 : 0);
  if (g.height !== undefined && g.height < bodyB - g.y + footH) fail(who, `height ${g.height} is too small for ${t.rows.length} rows (need at least ${Math.ceil(bodyB - g.y + footH)})`);
  const left = g.x + rowW, centred = (cy: number, n: number) => cy - (n - 1) * lh / 2 + S * 0.36;
  const headBase = (n: number) => t.ruled ? centred(g.y + headH / 2, n) : g.y + headH - 8 - (n - 1) * lh;

  if (t.ruled) c.asCell(() => c.rect(g.x, g.y, g.w, headH, {fill: 'accent', op: 0.1}));
  // highlighted columns are boxed under everything else
  t.cols.forEach((k, j) => { if (highlight.includes(k)) c.rect(r1(left + j * colW + 2), g.y, r1(colW - 4), r1(bodyB - g.y), {fill: 'accent', op: 0.08, stroke: 'accent', sw: 2}); });
  // ADR 0054: the column heads are a part, a row (its name, its ratings, notes and the rule under it) another
  c.withPart(partStep('columns', 0, ''), () => c.asCell(() => {
    if (corner.length) c.lines(corner, g.x + inset, headBase(corner.length), 'start', 'muted');
    t.cols.forEach((k, j) => { const hd = must(heads[j]); c.lines(hd, left + (j + 0.5) * colW, headBase(hd.length), 'middle', 'text', {bold: boldHead(k)}); });
    c.line(g.x, bodyT, g.x + g.w, bodyT, {stroke: 'text'});
  }));
  let y = bodyT;
  t.rows.forEach((r, i) => c.withPart(partStep('row', t.rowIds?.[i] ?? i, r), () => {
    const rh = must(rowH[i]), name = must(names[i]), rid = t.rowIds?.[i], cy = y + rh / 2, key = rid ?? `#${i}`;
    c.asCell(() => c.lines(name, g.x + inset, centred(cy, name.length), 'start', 'text', {bold: true, of: key}));
    if (rid) c.anchors.push({id: rid, x: g.x, y: r1(y), w: g.w, h: rh});
    must(t.cells[i]).forEach((cell, j) => {
      const cx = left + (j + 0.5) * colW;
      const rating = (x: number) => look.cellText ? c.asCell(() => look.draw(c, x, cy, (cell as {rating: T}).rating, key)) : look.draw(c, x, cy, (cell as {rating: T}).rating, key);
      if (cell === null) { c.asCell(() => c.text('—', cx, c.mid(cy), 'middle', 'muted', {of: key})); return; }
      if (!t.ruled) { rating(cx); return; }
      const x = left + j * colW, note = must(must(notes[i])[j]);
      rating(x + ratingW / 2);
      c.asCell(() => {
        c.line(x + ratingW, y + 6, x + ratingW, y + rh - 6, {stroke: 'muted', dash: '4,3', sw: 1, of: key});
        c.lines(note, x + ratingW + 8, centred(cy, note.length), 'start', 'text', {of: key});
      });
    });
    y += rh;
    c.asCell(() => c.line(g.x, y, g.x + g.w, y, {stroke: i === t.rows.length - 1 ? 'text' : 'border'}));
  }));
  if (t.ruled) c.asCell(() => t.cols.forEach((_k, j) => c.line(left + j * colW, g.y, left + j * colW, bodyB, {stroke: 'border'})));
  c.table = ratingGrid(t, look, {x: g.x, y: g.y, rowW, colW, headH, rowH, inset, size: S, pitch: lh, corner, heads, names, notes, boldHead});
  look.foot?.draw(c, bodyB);
  return c.done();
}

/** The table a rating table draws, cell by cell (the same places, colours and rules as above), for the PowerPoint export. */
function ratingGrid<T>(t: RatingTable<T>, look: RatingLook<T>, m: {x: number; y: number; rowW: number; colW: number; headH: number; rowH: number[]; inset: number; size: number; pitch: number;
  corner: string[]; heads: string[][]; names: string[][]; notes: string[][][]; boldHead: (k: string) => boolean}): ChartTable {
  const {ruled} = t, last = t.rows.length - 1;
  const BORDER: TableRule = {stroke: 'border', sw: 2}, DARK: TableRule = {stroke: 'text', sw: 2}, DASH: TableRule = {stroke: 'muted', sw: 1, dash: '4,3'};
  const colW = [m.rowW, ...t.cols.flatMap(() => ruled ? [look.ratingW, m.colW - look.ratingW] : [m.colW])];
  const head: TableCell = ruled ? {lines: [], align: 'middle', valign: 'middle', ink: 'text', fill: {key: 'accent', op: 0.1}} : {lines: [], align: 'middle', valign: 'bottom', padY: 8, ink: 'text'};
  const spanned = (cell: TableCell): (TableCell | null)[] => ruled ? [{...cell, span: 2}, null] : [cell];
  const header: (TableCell | null)[] = [
    {...head, lines: m.corner, align: 'start', padX: m.inset, ink: 'muted', b: DARK, ...(ruled ? {r: BORDER} : {})},
    ...t.cols.flatMap((k, j) => spanned({...head, lines: must(m.heads[j]), ...(m.boldHead(k) ? {bold: true} : {}), b: DARK, ...(ruled ? {l: BORDER} : {})})),
  ];
  const body = t.rows.map((_r, i): (TableCell | null)[] => {
    const sides = {t: i === 0 ? DARK : BORDER, b: i === last ? DARK : BORDER};
    const name: TableCell = {lines: must(m.names[i]), align: 'start', valign: 'middle', padX: m.inset, ink: 'text', bold: true, ...sides, ...(ruled ? {r: BORDER} : {})};
    return [name, ...must(t.cells[i]).flatMap((cell, j): (TableCell | null)[] => {
      const base: TableCell = {lines: [], align: 'middle', valign: 'middle', ink: 'text', ...sides, ...(ruled ? {l: BORDER} : {})};
      if (cell === null) return spanned({...base, lines: ['—'], ink: 'muted'});
      const mark = look.cellText?.(cell.rating);
      const rating: TableCell = mark ? {...base, lines: [mark.s], ink: mark.ink, ...(mark.bold ? {bold: true} : {})} : base;
      if (!ruled) return [rating];
      return [{...rating, r: DASH}, {lines: must(must(m.notes[i])[j]), align: 'start', valign: 'middle', padX: 8, ink: 'text', ...sides, l: DASH}];
    })];
  });
  return {x: m.x, y: m.y, colW, rowH: [m.headH, ...m.rowH], cells: [header, ...body], size: m.size, pitch: m.pitch};
}
