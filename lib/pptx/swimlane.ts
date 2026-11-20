// A swimlane's frame (its lanes, the label column and the phase headers) as a PowerPoint table, drawn as the svg draws it
// (emit-boxes.ts renderSwimlane): the label column grey (soft for an accent lane), the lanes' bodies alternately white and grey, a border-
// coloured line between lanes and between phases, a dark line after the label column and a dark frame. The steps and their arrows are
// separate bands drawn over it as shapes, so they stay glued; a boundary's dashed line is the rule between its two lanes, its name a chip
// drawn over the table. Not mapped: the rounded outer corners (a table's are square).
import {LINE_HEIGHT_EM, boundaryChipH} from '../layout-util.ts';
import type {ChartTable, TableCell, TableRule} from '../charts-base.ts';
import type {Roles} from '../types/core.ts';
import type {LaidOutSwimlane} from '../types/sequence-table-swimlane.ts';

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1;

/** The table of a swimlane's frame. Its body columns are cut where the phases begin and end, so each phase header is one (spanned) cell. */
export function swimlaneTable(b: LaidOutSwimlane, roles: Roles): ChartTable {
  const X1 = b.x + b.w, hasPh = b.phaseH > 0;
  const BORDER: TableRule = {stroke: 'border', sw: 2}, DARK: TableRule = {stroke: 'text', sw: 2}, FRAME: TableRule = {stroke: 'text', sw: 2.5};
  const BOUNDARY: TableRule = {stroke: 'text', sw: 3, dash: '10,6'};
  // the body's column edges: its sides and every phase's sides
  const edges = [b.bodyX, X1, ...b.phases.flatMap(p => [p.x, p.x + p.w])].map(x => Math.min(X1, Math.max(b.bodyX, x))).toSorted((p, q) => p - q)
    .filter((x, i, xs) => i === 0 || !near(x, xs[i - 1] as number));
  const bodyW = edges.slice(1).map((x, i) => x - (edges[i] as number)), n = bodyW.length;
  const colAt = (x: number): number => edges.findIndex(e => near(e, x));
  // a text block whose first line's top the svg puts at `top` (its baseline at top + size): the inset that puts it there in a cell at rowY
  const textCell = (lines: string[], size: number, top: number, rowY: number): Pick<TableCell, 'lines' | 'size' | 'pitch' | 'valign' | 'padY'> => {
    const pitch = size * LINE_HEIGHT_EM;
    return {lines, size, pitch, valign: 'top', padY: Math.max(0, top + size - pitch * 0.8 - rowY)};
  };
  const boundaryAt = (y: number): boolean => (b.boundaries ?? []).some(bd => near(bd.y, y));
  const rows: (TableCell | null)[][] = [], rowH: number[] = [];
  if (hasPh) {
    const header: (TableCell | null)[] = [{lines: [], align: 'middle', valign: 'top', ink: 'text', fill: {key: 'code'}, l: FRAME, t: FRAME, r: DARK, b: BORDER}];
    for (let j = 0; j < n;) {
      const ph = b.phases.find(p => colAt(p.x) === j && p.w > 1);
      const span = ph ? Math.max(1, colAt(Math.min(X1, ph.x + ph.w)) - j) : 1;
      const edge = {t: FRAME, b: BORDER, ...(j === 0 ? {l: DARK} : b.phases.some(p => colAt(p.x) === j) ? {l: BORDER} : {}), ...(j + span === n ? {r: FRAME} : {})};
      header.push({...(ph ? textCell(ph.lines, roles.note, b.y + 8, b.y) : {lines: []}), align: 'middle', ink: 'accent', bold: true, fill: {key: 'soft'}, ...edge, ...(span > 1 ? {span} : {})} as TableCell);
      for (let k = 1; k < span; k++) header.push(null);
      j += span;
    }
    rows.push(header); rowH.push(b.phaseH);
  }
  b.lanes.forEach((ln, i) => {
    const first = i === 0 && !hasPh, last = i === b.lanes.length - 1;
    const t = first ? FRAME : boundaryAt(ln.y) ? BOUNDARY : BORDER;
    const below = last ? FRAME : boundaryAt(ln.y + ln.h) ? BOUNDARY : BORDER;
    const label: TableCell = {...textCell(ln.labelLines, roles.title, ln.labelTop, ln.y), align: 'middle', ink: ln.tone === 'accent' ? 'accent' : 'text', bold: true,
      fill: {key: ln.tone === 'accent' ? 'soft' : 'code'}, l: FRAME, r: DARK, t, b: below};
    const body: TableCell = {lines: [], align: 'middle', valign: 'top', ink: 'text', fill: {key: i % 2 === 0 ? 'bg' : 'code'}, l: DARK, r: FRAME, t, b: below, ...(n > 1 ? {span: n} : {})};
    rows.push([label, body, ...Array.from({length: n - 1}, () => null)]); rowH.push(ln.h);
  });
  return {x: b.x, y: b.y, colW: [b.labelW, ...bodyW], rowH, cells: rows, size: roles.note, pitch: roles.note * LINE_HEIGHT_EM};
}

/** The chips that name a boundary, drawn over the table: where they are and what they say. */
export function boundaryChips(b: LaidOutSwimlane, roles: Roles): {x: number; y: number; w: number; h: number; label: string}[] {
  const h = boundaryChipH(roles.note);
  return (b.boundaries ?? []).flatMap(bd => bd.label ? [{x: Math.round(b.x + 8), y: Math.round(Math.round(bd.y) - h / 2), w: b.labelW - 16, h, label: bd.label}] : []);
}
