// The table harvey() and compare() both draw: criteria as rows, options as columns, a rating in every cell and, when the table is `ruled`,
// a note beside it behind a dashed line. A band says what a rating looks like (`RatingLook`); everything else is here.
import {partStep} from './parts.ts';
import {must} from './must.ts';
import {Canvas, fail} from './charts-base.ts';
import type {ChartGeom, LaidOutChartPart} from './charts-base.ts';

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

  if (t.ruled) c.rect(g.x, g.y, g.w, headH, {fill: 'accent', op: 0.1});
  // highlighted columns are boxed under everything else
  t.cols.forEach((k, j) => { if (highlight.includes(k)) c.rect(r1(left + j * colW + 2), g.y, r1(colW - 4), r1(bodyB - g.y), {fill: 'accent', op: 0.08, stroke: 'accent', sw: 2}); });
  // ADR 0054: the column heads are a part, a row (its name, its ratings, notes and the rule under it) another
  c.withPart(partStep('columns', 0, ''), () => {
    if (corner.length) c.lines(corner, g.x + inset, headBase(corner.length), 'start', 'muted');
    t.cols.forEach((k, j) => { const hd = must(heads[j]); c.lines(hd, left + (j + 0.5) * colW, headBase(hd.length), 'middle', 'text', {bold: boldHead(k)}); });
    c.line(g.x, bodyT, g.x + g.w, bodyT, {stroke: 'text'});
  });
  let y = bodyT;
  t.rows.forEach((r, i) => c.withPart(partStep('row', t.rowIds?.[i] ?? i, r), () => {
    const rh = must(rowH[i]), name = must(names[i]), rid = t.rowIds?.[i], cy = y + rh / 2, key = rid ?? `#${i}`;
    c.lines(name, g.x + inset, centred(cy, name.length), 'start', 'text', {bold: true, of: key});
    if (rid) c.anchors.push({id: rid, x: g.x, y: r1(y), w: g.w, h: rh});
    must(t.cells[i]).forEach((cell, j) => {
      const cx = left + (j + 0.5) * colW;
      if (cell === null) { c.text('—', cx, c.mid(cy), 'middle', 'muted', {of: key}); return; }
      if (!t.ruled) { look.draw(c, cx, cy, cell.rating, key); return; }
      const x = left + j * colW, note = must(must(notes[i])[j]);
      look.draw(c, x + ratingW / 2, cy, cell.rating, key);
      c.line(x + ratingW, y + 6, x + ratingW, y + rh - 6, {stroke: 'muted', dash: '4,3', sw: 1, of: key});
      c.lines(note, x + ratingW + 8, centred(cy, note.length), 'start', 'text', {of: key});
    });
    y += rh;
    c.line(g.x, y, g.x + g.w, y, {stroke: i === t.rows.length - 1 ? 'text' : 'border'});
  }));
  if (t.ruled) t.cols.forEach((_k, j) => c.line(left + j * colW, g.y, left + j * colW, bodyB, {stroke: 'border'}));
  look.foot?.draw(c, bodyB);
  return c.done();
}
