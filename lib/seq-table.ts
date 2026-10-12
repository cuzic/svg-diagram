// sequence() and table() — layout half. Both are self-contained blocks: they
// take an origin + width, wrap their own text with the shared measurer, and
// return one placed band whose geometry emit.ts draws verbatim.
//
// Text requests (collectTextRequests) and layout (layoutSequence/layoutTable)
// must agree on every string/size/weight/font, so both go through the same
// prepare step.

import {splitAtoms, textWidth} from './atoms.ts';
import {wrapAtoms} from './wrap.ts';
import {CELL_MARKS} from './tokens.ts';
import type {
  SequenceBand, PreparedSequence, PreparedStep, TableBand, TableCell, TableColumn, TableRow, ResolvedCell, TextRequest,
  WidthOf, FontFamily, LaidOutSequence, LaidOutSeqStep, LaidOutSeqHead, LaidOutTable, LaidOutTableRow, LaidOutTableCell,
  TextTone, BoxTone, Roles,
} from './types.ts';

const LH = 1.4;
const lineH = (size: number) => size * LH;

// ---- sequence ---------------------------------------------------------------
export const SEQ = {headPadY: 12, headPadX: 12, stepGap: 14, labelGap: 10, selfW: 36, noteH: 8, dividerH: 36};

export function prepareSequence(band: SequenceBand): PreparedSequence {
  let n = 0;
  const steps = band.steps.map((s): PreparedStep => {
    if (s.divider !== undefined) return {...s, kind: 'divider', text: s.divider};
    if (s.note !== undefined) return {...s, kind: 'note', text: s.note, over: [s.over].flat()};
    const numbered = band.numbered !== false && s.number !== false;
    const text = numbered ? `${++n}. ${s.label}` : s.label;
    return s.self !== undefined ? {...s, kind: 'self', text} : {...s, kind: 'msg', text};
  });
  return {...band, steps};
}

export function collectTextRequests(band: SequenceBand | TableBand, roles: Roles): TextRequest[] {
  const out: TextRequest[] = [];
  if (band.type === 'sequence') {
    const p = prepareSequence(band);
    for (const a of p.actors) out.push([a.label, roles.title, 700, 'sans']);
    for (const s of p.steps) out.push([s.text, roles.note, s.kind === 'divider' ? 700 : 400, 'sans']);
  } else if (band.type === 'table') {
    if (band.title) out.push([band.title, roles.title, 700, 'sans']);
    band.columns.forEach((c) => {
      if (c.label) out.push([c.label, roles.body, 700, 'sans']);
    });
    for (const row of band.rows) ('cells' in row ? row.cells : row).forEach((cell, i) => {
      const c = cellOf(cell, band.columns[i]);
      out.push([c.text, roles.body, c.bold || (band.rowHeader && i === 0) ? 700 : 400, c.mono ? 'mono' : 'sans']);
    });
  }
  return out;
}

const wrap = (text: string, size: number, weight: number, font: FontFamily, maxW: number, widthOf: WidthOf) =>
  wrapAtoms(splitAtoms(text), {maxWidth: Math.max(20, maxW), atomWidth: (a) => widthOf(a, size, weight, font)});
const textW = (text: string, size: number, weight: number, font: FontFamily, widthOf: WidthOf) => textWidth(widthOf, text, size, weight, font);

export function layoutSequence(band: SequenceBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutSequence {
  const p = prepareSequence(band);
  const n = p.actors.length;
  const colW = w / n;
  const aw = Math.min(200, colW - 16);
  const cx = p.actors.map((_, i) => x + colW * (i + 0.5));
  const idx = new Map(p.actors.map((a, i) => [a.id, i]));
  const at = (id: string, what: string): number => {
    const i = idx.get(id);
    if (i === undefined) throw new Error(`sequence(): unknown actor "${id}" in ${what}`);
    return i;
  };

  const heads = p.actors.map((a, i): LaidOutSeqHead => {
    const lines = wrap(a.label, roles.title, 700, 'sans', aw - 2 * SEQ.headPadX, widthOf);
    return {id: a.id, tone: a.tone, lines, x: cx[i] - aw / 2, w: aw, cx: cx[i], y: 0, h: 0};
  });
  const headH = Math.max(...heads.map(h => h.lines.length)) * lineH(roles.title) + 2 * SEQ.headPadY;
  for (const h of heads) { h.y = y; h.h = headH; }

  let cursor = y + headH;
  const steps: LaidOutSeqStep[] = [];
  for (const s of p.steps) {
    const top = cursor + SEQ.stepGap / 2;
    if (s.kind === 'msg') {
      const i = at(s.from, 'from'), j = at(s.to, 'to');
      if (i === j) throw new Error(`sequence(): message "${s.label}" has from === to; use {self: id}`);
      const span = Math.abs(cx[j] - cx[i]);
      // a label may run across neighbouring lifelines (as in UML); it only has to stay on the canvas
      const mid = (cx[i] + cx[j]) / 2;
      const room = Math.min(2 * (mid - x), 2 * (x + w - mid)) - 8;
      const lines = wrap(s.text, roles.note, 400, 'sans', Math.min(room, Math.max(span - 20, 320)), widthOf);
      const labelH = lines.length * lineH(roles.note);
      const ay = top + labelH + SEQ.labelGap;
      steps.push({kind: 'msg', x1: cx[i], x2: cx[j], y: ay, lines, labelTop: top, lx: (cx[i] + cx[j]) / 2, line: s.line ?? 'solid', arrow: s.arrow ?? 'end', tone: s.tone});
      cursor = ay + SEQ.stepGap;
    } else if (s.kind === 'self') {
      const i = at(s.self, 'self');
      // The loop and its label go on the right of the lifeline, unless the label does not fit there at its natural
      // width and the left side has more room (the last actor): then both mirror to the left, inside the frame.
      const rightRoom = x + w - (cx[i] + SEQ.selfW + 8) - 4, leftRoom = cx[i] - SEQ.selfW - 8 - x - 4;
      const side = textW(s.text, roles.note, 400, 'sans', widthOf) > rightRoom && leftRoom > rightRoom ? 'left' : 'right';
      const lx = side === 'left' ? cx[i] - SEQ.selfW - 8 : cx[i] + SEQ.selfW + 8;
      const lines = wrap(s.text, roles.note, 400, 'sans', Math.max(40, side === 'left' ? leftRoom : rightRoom), widthOf);
      const labelH = lines.length * lineH(roles.note);
      const loopH = 22;
      const rowH = Math.max(labelH, loopH + 12);
      steps.push({kind: 'self', cx: cx[i], y: top + 6, loopH, lines, lx, side, labelTop: top, line: s.line ?? 'solid', tone: s.tone});
      cursor = top + rowH + SEQ.stepGap / 2;
    } else if (s.kind === 'note') {
      const ids = s.over.map(id => at(id, 'note.over'));
      const lo = Math.min(...ids), hi = Math.max(...ids);
      let left: number, right: number;
      if (lo === hi) { const nw = Math.min(aw + 40, 260); left = cx[lo] - nw / 2; right = cx[lo] + nw / 2; }
      else { left = Math.max(x, cx[lo] - 60); right = Math.min(x + w, cx[hi] + 60); }
      const lines = wrap(s.text, roles.note, 400, 'sans', right - left - 24, widthOf);
      const h = lines.length * lineH(roles.note) + 16;
      steps.push({kind: 'note', x: left, y: top, w: right - left, h, lines, tone: s.tone ?? 'muted'});
      cursor = top + h + SEQ.stepGap / 2;
    } else { // divider
      const tw = textW(s.text, roles.note, 700, 'sans', widthOf) + 24;
      steps.push({kind: 'divider', y: top + 14, x1: x, x2: x + w, cx: x + w / 2, chipW: tw, text: s.text});
      cursor = top + SEQ.dividerH - SEQ.stepGap / 2;
    }
  }
  const bottom = cursor + 4;
  return {type: 'sequence', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: bottom - y, heads, steps, lifeTop: y + headH, lifeBottom: bottom};
}

// ---- table ------------------------------------------------------------------
export const TBL = {padX: 12, padY: 8, padYDense: 4};

// A cell is a string or {text, tone?, bold?, mono?}; column defaults apply underneath.
export function cellOf(cell: TableCell, col: TableColumn = {}): ResolvedCell {
  const c = typeof cell === 'string' || typeof cell === 'number' ? {text: String(cell)} as Exclude<typeof cell, string | number> : {...cell};
  const mark = c.mark ? CELL_MARKS[c.mark] : undefined;
  if (c.mark && !mark) throw new Error(`table cell: unknown mark "${c.mark}" (use ${Object.keys(CELL_MARKS).join(' | ')})`);
  const text = mark ? (c.text ? `${mark.glyph} ${c.text}` : mark.glyph) : c.text ?? '';
  return {text, tone: c.tone ?? mark?.tone, bold: c.bold ?? mark?.bold ?? col.bold ?? false, mono: c.mono ?? col.mono ?? false, align: c.align ?? col.align ?? 'left'};
}

export function layoutTable(band: TableBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutTable {
  const cols = band.columns;
  const tw = Math.min(w, band.width ?? w);
  const left = x + (w - tw) / 2;
  const flexSum = cols.reduce((s, c) => s + (c.flex ?? 1), 0);
  const colW = cols.map(c => tw * (c.flex ?? 1) / flexSum);
  const colX: number[] = []; let ax = left;
  for (const cw of colW) { colX.push(ax); ax += cw; }

  const padY = band.dense ? TBL.padYDense : TBL.padY;
  let cy = y;
  let titleBar: LaidOutTable['titleBar'] = null;
  if (band.title) {
    const lines = wrap(band.title, roles.title, 700, 'sans', tw - 2 * TBL.padX, widthOf);
    const h = lines.length * lineH(roles.title) + 2 * TBL.padY;
    titleBar = {y: cy, h, lines};
    cy += h;
  }
  const rowOf = (cells: readonly (TableColumn | TableCell)[], header: boolean, tone?: BoxTone, rowH?: number): LaidOutTableRow => {
    const placed = cells.map((cell, i): LaidOutTableCell => {
      // header rows pass the column specs themselves (see the call below)
      const c: ResolvedCell = header ? {text: (cell as TableColumn).label ?? '', bold: true, mono: false, align: (cell as TableColumn).align ?? 'left'} : cellOf(cell as TableCell, cols[i]);
      if (band.rowHeader && !header && i === 0) c.bold = true;
      const size = roles.body;
      const lines = c.text === '' ? [] : wrap(c.text, size, c.bold ? 700 : 400, c.mono ? 'mono' : 'sans', colW[i] - 2 * TBL.padX, widthOf);
      return {...c, lines, x: colX[i], w: colW[i], top: 0};
    });
    const nLines = Math.max(1, ...placed.map(c => c.lines.length));
    const need = nLines * lineH(roles.body) + 2 * padY;
    const fixed = rowH ?? (header ? band.headerH : undefined) ?? band.cellH;
    if (fixed !== undefined && fixed < need) throw new Error(`table(): ${rowH !== undefined ? 'h' : header && band.headerH !== undefined ? 'headerH' : 'cellH'} ${fixed} is too small for a row that needs ${Math.ceil(need)}px (${nLines} line(s) of ${roles.body}px text). Raise it or shorten the text`);
    const h = fixed ?? need;
    // fixed-height rows centre their text; content-height rows keep it top-aligned (the output before cellH existed)
    for (const c of placed) c.top = fixed === undefined ? cy + padY : cy + (h - c.lines.length * lineH(roles.body)) / 2;
    const row: LaidOutTableRow = {y: cy, h, cells: placed, header, tone};
    cy += h;
    return row;
  };
  const rows: LaidOutTableRow[] = [];
  const hasHeader = cols.some(c => c.label) && band.header !== false;
  if (hasHeader) rows.push(rowOf(cols, true));
  for (const r of band.rows) {
    const cells = 'cells' in r ? r.cells : r;
    rows.push(rowOf(cells, false, 'cells' in r ? r.tone : undefined, 'cells' in r ? r.h : undefined));
  }
  return {type: 'table', id: band.id, x: left, y, w: tw, h: cy - y, titleBar, rows, colX, colW, tone: band.tone, rowHeader: band.rowHeader || undefined, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), bodySize: roles.body};
}
