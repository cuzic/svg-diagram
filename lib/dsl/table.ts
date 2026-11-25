
import {resolveIcon} from '../icon-registry.ts';
import type {TableBand, TableCell, TableCellSpec, TableColumn, TableOpts, TableRow} from '../types/sequence-table-swimlane.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {assertBoxTone, revealOf, withHandle} from './shared.ts';

// Table with a header row. columns: [{label, flex?, mono?, bold?, align?: 'left'|'center'|'right'}].
// rows: [cell, ...] or {cells: [...], tone?: 'accent'|'new'|'changed'|'removed'|'muted'|'danger'};
// a cell is a string or {text, tone?: 'accent'|'muted'|'danger', bold?, mono?, align?}.
// title adds an accent bar on top (an ER entity name, a table caption); header: false hides
// the column-label row; width narrows the table (centered); cellH fixes every row's height (text centred; throws if a cell needs more),
// a row's own `h` and headerH override it for that row / the header; dense trims the row padding to 4px;
// rowHeader: true makes the left column a row heading (bold, soft fill, heavy rule on its right; top-aligned unless the row has a fixed height).
export function table<const Id extends string = never>(columns: TableColumn[], rows: readonly TableRow[], opts?: TableOpts & {id?: Id}): TableBand & Declares<Id> & HandleOf<Id>;
export function table(columns: TableColumn[], rows: readonly TableRow[], opts: TableOpts = {}): TableBand {
  assertBoxTone(opts.tone, 'table()');
  rows.forEach((r, i) => { if (!Array.isArray(r)) assertBoxTone((r as {tone?: string}).tone, `table() row ${i}`); });
  if (opts.rowHeader !== undefined && typeof opts.rowHeader !== 'boolean') throw new Error(`table(): rowHeader must be true or false, got ${JSON.stringify(opts.rowHeader)}`);
  if (opts.rowHeader && columns.length < 2) throw new Error('table(): rowHeader needs at least 2 columns (the first is the row heading, the rest are the body)');
  // an icon is resolved here (the shell) and carried on the cell, so layout and emit stay free of I/O
  const withGlyph = (c: TableCell): TableCell => typeof c === 'object' && c.icon !== undefined ? {...c, iconGlyph: resolveIcon(c.icon, 'table() cell icon')} : c;
  const placedRows = rows.map(r => Array.isArray(r) ? r.map(withGlyph) : {...(r as {cells: readonly TableCell[]}), cells: (r as {cells: readonly TableCell[]}).cells.map(withGlyph)}) as TableRow[];
  return withHandle({type: 'table', columns, rows: placedRows, title: opts.title, header: opts.header, width: opts.width, tone: opts.tone, cellH: opts.cellH, headerH: opts.headerH, dense: opts.dense, rowHeader: opts.rowHeader, id: opts.id, ...revealOf(opts)}, opts.id);
}
// A table cell with a status symbol: `cell('通る', {mark: 'ok'})` draws "○ 通る" in the accent tone; mark: 'ok' ○ | 'mid' △ | 'ng' × | 'best' ◎.
// `cell('', {mark: 'ng'})` is the symbol alone. The symbol says it, the colour only reinforces it (never colour alone).
//
// A table cell whose tone stays a literal when the cell is built apart from the table() call
// (`const c = {text: '通る', tone: 'accent'}` widens tone to string; `cell('通る', {tone: 'accent'})` does not).
export function cell(text: string | number, opts: Omit<TableCellSpec, 'text'> = {}): TableCellSpec {
  return {text: String(text), ...opts};
}
