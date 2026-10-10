// sequence() and table() — layout half. Both are self-contained blocks: they
// take an origin + width, wrap their own text with the shared measurer, and
// return one placed band whose geometry emit.mjs draws verbatim.
//
// Text requests (collectTextRequests) and layout (layoutSequence/layoutTable)
// must agree on every string/size/weight/font, so both go through the same
// prepare step.

import {splitAtoms} from './measure.mjs';
import {wrapAtoms} from './wrap.mjs';
import {ROLES} from './tokens.mjs';

const LH = 1.4;
const lineH = (size) => size * LH;

// ---- sequence ---------------------------------------------------------------
export const SEQ = {headPadY: 12, headPadX: 12, stepGap: 14, labelGap: 10, selfW: 36, noteH: 8, dividerH: 36};

export function prepareSequence(band) {
  let n = 0;
  const steps = band.steps.map(s => {
    if (s.divider !== undefined) return {...s, kind: 'divider', text: s.divider};
    if (s.note !== undefined) return {...s, kind: 'note', text: s.note, over: [s.over].flat()};
    const kind = s.self !== undefined ? 'self' : 'msg';
    const numbered = band.numbered !== false && s.number !== false;
    return {...s, kind, text: numbered ? `${++n}. ${s.label}` : s.label};
  });
  return {...band, steps};
}

export function collectTextRequests(band) {
  const out = [];
  if (band.type === 'sequence') {
    const p = prepareSequence(band);
    for (const a of p.actors) out.push([a.label, ROLES.title, 700, 'sans']);
    for (const s of p.steps) out.push([s.text, ROLES.note, s.kind === 'divider' ? 700 : 400, 'sans']);
  } else if (band.type === 'table') {
    if (band.title) out.push([band.title, ROLES.title, 700, 'sans']);
    band.columns.forEach((c, i) => {
      if (c.label) out.push([c.label, ROLES.body, 700, 'sans']);
    });
    for (const row of band.rows) (Array.isArray(row) ? row : row.cells).forEach((cell, i) => {
      const c = cellOf(cell, band.columns[i]);
      out.push([c.text, ROLES.body, c.bold ? 700 : 400, c.mono ? 'mono' : 'sans']);
    });
  }
  return out;
}

const wrap = (text, size, weight, font, maxW, widthOf) =>
  wrapAtoms(splitAtoms(text), {maxWidth: Math.max(20, maxW), atomWidth: (a) => widthOf(a, size, weight, font)});
const textW = (text, size, weight, font, widthOf) =>
  [...splitAtoms(text)].reduce((s, a) => s + widthOf(a, size, weight, font), 0);

export function layoutSequence(band, x, y, w, widthOf) {
  const p = prepareSequence(band);
  const n = p.actors.length;
  const colW = w / n;
  const aw = Math.min(200, colW - 16);
  const cx = p.actors.map((_, i) => x + colW * (i + 0.5));
  const idx = new Map(p.actors.map((a, i) => [a.id, i]));
  const at = (id, what) => {
    if (!idx.has(id)) throw new Error(`sequence(): unknown actor "${id}" in ${what}`);
    return idx.get(id);
  };

  const heads = p.actors.map((a, i) => {
    const lines = wrap(a.label, ROLES.title, 700, 'sans', aw - 2 * SEQ.headPadX, widthOf);
    return {id: a.id, tone: a.tone, lines, x: cx[i] - aw / 2, w: aw, cx: cx[i]};
  });
  const headH = Math.max(...heads.map(h => h.lines.length)) * lineH(ROLES.title) + 2 * SEQ.headPadY;
  for (const h of heads) { h.y = y; h.h = headH; }

  let cursor = y + headH;
  const steps = [];
  for (const s of p.steps) {
    const top = cursor + SEQ.stepGap / 2;
    if (s.kind === 'msg') {
      const i = at(s.from, 'from'), j = at(s.to, 'to');
      if (i === j) throw new Error(`sequence(): message "${s.label}" has from === to; use {self: id}`);
      const span = Math.abs(cx[j] - cx[i]);
      // a label may run across neighbouring lifelines (as in UML); it only has to stay on the canvas
      const mid = (cx[i] + cx[j]) / 2;
      const room = Math.min(2 * (mid - x), 2 * (x + w - mid)) - 8;
      const lines = wrap(s.text, ROLES.note, 400, 'sans', Math.min(room, Math.max(span - 20, 320)), widthOf);
      const labelH = lines.length * lineH(ROLES.note);
      const ay = top + labelH + SEQ.labelGap;
      steps.push({kind: 'msg', x1: cx[i], x2: cx[j], y: ay, lines, labelTop: top, lx: (cx[i] + cx[j]) / 2, line: s.line ?? 'solid', arrow: s.arrow ?? 'end', tone: s.tone});
      cursor = ay + SEQ.stepGap;
    } else if (s.kind === 'self') {
      const i = at(s.self, 'self');
      const lx = cx[i] + SEQ.selfW + 8;
      const lines = wrap(s.text, ROLES.note, 400, 'sans', Math.max(120, x + w - lx - 4), widthOf);
      const labelH = lines.length * lineH(ROLES.note);
      const loopH = 22;
      const rowH = Math.max(labelH, loopH + 12);
      steps.push({kind: 'self', cx: cx[i], y: top + 6, loopH, lines, lx, labelTop: top, line: s.line ?? 'solid', tone: s.tone});
      cursor = top + rowH + SEQ.stepGap / 2;
    } else if (s.kind === 'note') {
      const ids = s.over.map(id => at(id, 'note.over'));
      const lo = Math.min(...ids), hi = Math.max(...ids);
      let left, right;
      if (lo === hi) { const nw = Math.min(aw + 40, 260); left = cx[lo] - nw / 2; right = cx[lo] + nw / 2; }
      else { left = Math.max(x, cx[lo] - 60); right = Math.min(x + w, cx[hi] + 60); }
      const lines = wrap(s.text, ROLES.note, 400, 'sans', right - left - 24, widthOf);
      const h = lines.length * lineH(ROLES.note) + 16;
      steps.push({kind: 'note', x: left, y: top, w: right - left, h, lines, tone: s.tone ?? 'muted'});
      cursor = top + h + SEQ.stepGap / 2;
    } else { // divider
      const tw = textW(s.text, ROLES.note, 700, 'sans', widthOf) + 24;
      steps.push({kind: 'divider', y: top + 14, x1: x, x2: x + w, cx: x + w / 2, chipW: tw, text: s.text});
      cursor = top + SEQ.dividerH - SEQ.stepGap / 2;
    }
  }
  const bottom = cursor + 4;
  return {type: 'sequence', id: band.id, x, y, w, h: bottom - y, heads, steps, lifeTop: y + headH, lifeBottom: bottom};
}

// ---- table ------------------------------------------------------------------
export const TBL = {padX: 12, padY: 8};

// A cell is a string or {text, tone?, bold?, mono?}; column defaults apply underneath.
export function cellOf(cell, col = {}) {
  const c = typeof cell === 'string' || typeof cell === 'number' ? {text: String(cell)} : {...cell};
  return {text: c.text ?? '', tone: c.tone, bold: c.bold ?? col.bold ?? false, mono: c.mono ?? col.mono ?? false, align: c.align ?? col.align ?? 'left'};
}

export function layoutTable(band, x, y, w, widthOf) {
  const cols = band.columns;
  const tw = Math.min(w, band.width ?? w);
  const left = x + (w - tw) / 2;
  const flexSum = cols.reduce((s, c) => s + (c.flex ?? 1), 0);
  const colW = cols.map(c => tw * (c.flex ?? 1) / flexSum);
  const colX = []; let ax = left;
  for (const cw of colW) { colX.push(ax); ax += cw; }

  let cy = y;
  let titleBar = null;
  if (band.title) {
    const lines = wrap(band.title, ROLES.title, 700, 'sans', tw - 2 * TBL.padX, widthOf);
    const h = lines.length * lineH(ROLES.title) + 2 * TBL.padY;
    titleBar = {y: cy, h, lines};
    cy += h;
  }
  const rowOf = (cells, header, tone) => {
    const placed = cells.map((cell, i) => {
      const c = header ? {text: cell.label ?? '', bold: true, mono: false, align: cell.align ?? 'left'} : cellOf(cell, cols[i]);
      const size = ROLES.body;
      const lines = c.text === '' ? [] : wrap(c.text, size, c.bold ? 700 : 400, c.mono ? 'mono' : 'sans', colW[i] - 2 * TBL.padX, widthOf);
      return {...c, lines, x: colX[i], w: colW[i]};
    });
    const h = Math.max(1, ...placed.map(c => c.lines.length)) * lineH(ROLES.body) + 2 * TBL.padY;
    const row = {y: cy, h, cells: placed, header, tone};
    cy += h;
    return row;
  };
  const rows = [];
  const hasHeader = cols.some(c => c.label) && band.header !== false;
  if (hasHeader) rows.push(rowOf(cols, true));
  for (const r of band.rows) {
    const cells = Array.isArray(r) ? r : r.cells;
    rows.push(rowOf(cells, false, Array.isArray(r) ? undefined : r.tone));
  }
  return {type: 'table', id: band.id, x: left, y, w: tw, h: cy - y, titleBar, rows, colX, colW, tone: band.tone};
}
