import { resolveIcon } from '../icon-registry.js';
import { assertBoxTone, revealOf, withHandle } from './shared.js';
export function table(columns, rows, opts = {}) {
    assertBoxTone(opts.tone, 'table()');
    rows.forEach((r, i) => { if (!Array.isArray(r))
        assertBoxTone(r.tone, `table() row ${i}`); });
    if (opts.rowHeader !== undefined && typeof opts.rowHeader !== 'boolean')
        throw new Error(`table(): rowHeader must be true or false, got ${JSON.stringify(opts.rowHeader)}`);
    if (opts.rowHeader && columns.length < 2)
        throw new Error('table(): rowHeader needs at least 2 columns (the first is the row heading, the rest are the body)');
    // an icon is resolved here (the shell) and carried on the cell, so layout and emit stay free of I/O
    const withGlyph = (c) => typeof c === 'object' && c.icon !== undefined ? { ...c, iconGlyph: resolveIcon(c.icon, 'table() cell icon') } : c;
    const placedRows = rows.map(r => Array.isArray(r) ? r.map(withGlyph) : { ...r, cells: r.cells.map(withGlyph) });
    return withHandle({ type: 'table', columns, rows: placedRows, title: opts.title, header: opts.header, width: opts.width, tone: opts.tone, cellH: opts.cellH, headerH: opts.headerH, dense: opts.dense, rowHeader: opts.rowHeader, id: opts.id, ...revealOf(opts) }, opts.id);
}
// A table cell with a status symbol: `cell('通る', {mark: 'ok'})` draws "○ 通る" in the accent tone; mark: 'ok' ○ | 'mid' △ | 'ng' × | 'best' ◎.
// `cell('', {mark: 'ng'})` is the symbol alone. The symbol says it, the colour only reinforces it (never colour alone).
//
// A table cell whose tone stays a literal when the cell is built apart from the table() call
// (`const c = {text: '通る', tone: 'accent'}` widens tone to string; `cell('通る', {tone: 'accent'})` does not).
export function cell(text, opts = {}) {
    return { text: String(text), ...opts };
}
