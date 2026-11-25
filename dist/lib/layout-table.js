import { textWidth } from './atoms.js';
import { CELL_MARKS } from './tokens.js';
import { must } from './must.js';
import { lineH, wrap } from './seq-table-text.js';
export function tableTexts(band, roles) {
    const out = [];
    if (band.title)
        out.push([band.title, roles.title, 700, 'sans']);
    band.columns.forEach((c) => {
        if (c.label)
            out.push([c.label, roles.body, 700, 'sans']);
    });
    for (const row of band.rows)
        ('cells' in row ? row.cells : row).forEach((cell, i) => {
            const c = cellOf(cell, band.columns[i]);
            out.push([c.text, roles.body, c.bold || (band.rowHeader && i === 0) ? 700 : 400, c.mono ? 'mono' : 'sans']);
        });
    return out;
}
export const TBL = { padX: 12, padY: 8, padYDense: 4, iconSize: 18, iconGap: 6 };
const CURVE_MIN = 30;
// A cell is a string or {text, tone?, bold?, mono?}; column defaults apply underneath.
export function cellOf(cell, col = {}) {
    const c = typeof cell === 'string' || typeof cell === 'number' ? { text: String(cell) } : { ...cell };
    const mark = c.mark ? CELL_MARKS[c.mark] : undefined;
    if (c.mark && !mark)
        throw new Error(`table cell: unknown mark "${c.mark}" (use ${Object.keys(CELL_MARKS).join(' | ')})`);
    const text = mark ? (c.text ? `${mark.glyph} ${c.text}` : mark.glyph) : c.text ?? '';
    const icon = c.icon !== undefined ? { name: c.icon, glyph: c.iconGlyph, ...(c.iconTone ? { tone: c.iconTone } : {}) } : undefined;
    return { text, tone: c.tone ?? mark?.tone, bold: c.bold ?? mark?.bold ?? col.bold ?? false, mono: c.mono ?? col.mono ?? false, align: c.align ?? col.align ?? 'left', vAlign: c.vAlign, ...(icon ? { icon } : {}) };
}
export function layoutTable(band, x, y, w, widthOf, roles, mode) {
    const cols = band.columns;
    const tw = Math.min(w, band.width ?? w);
    const left = x + (w - tw) / 2;
    const flexSum = cols.reduce((s, c) => s + (c.flex ?? 1), 0);
    const colW = cols.map(c => tw * (c.flex ?? 1) / flexSum);
    const colX = [];
    let ax = left;
    for (const cw of colW) {
        colX.push(ax);
        ax += cw;
    }
    const padY = band.dense ? TBL.padYDense : TBL.padY;
    let cy = y;
    let titleBar = null;
    if (band.title) {
        const lines = wrap(band.title, roles.title, 700, 'sans', tw - 2 * TBL.padX, widthOf, mode);
        const h = lines.length * lineH(roles.title) + 2 * TBL.padY;
        titleBar = { y: cy, h, lines };
        cy += h;
    }
    const rowOf = (cells, header, tone, rowH, curve = false) => {
        const placed = cells.map((cell, i) => {
            // header rows pass the column specs themselves (see the call below)
            const c = header ? { text: cell.label ?? '', bold: true, mono: false, align: cell.align ?? 'left' } : cellOf(cell, cols[i]);
            if (band.rowHeader && !header && i === 0)
                c.bold = true;
            const size = roles.body;
            const lines = c.text === '' ? [] : wrap(c.text, size, c.bold ? 700 : 400, c.mono ? 'mono' : 'sans', must(colW[i]) - 2 * TBL.padX - (c.icon ? TBL.iconSize + TBL.iconGap : 0), widthOf, mode);
            // an icon beside centred / right-aligned text sits just before its first line (left-aligned: at the cell's left edge)
            const lineW = c.icon && lines.length && c.align !== 'left' ? textWidth(widthOf, must(lines[0]), size, c.bold ? 700 : 400, c.mono ? 'mono' : 'sans') : undefined;
            return { ...c, lines, x: must(colX[i]), w: must(colW[i]), top: 0, ...(lineW !== undefined ? { lineW } : {}) };
        });
        const nLines = Math.max(1, ...placed.map(c => c.lines.length));
        const need = nLines * lineH(roles.body) + 2 * padY;
        const fixed = rowH ?? (header ? band.headerH : undefined) ?? band.cellH;
        if (fixed !== undefined && fixed < need)
            throw new Error(`table(): ${rowH !== undefined ? 'h' : header && band.headerH !== undefined ? 'headerH' : 'cellH'} ${fixed} is too small for a row that needs ${Math.ceil(need)}px (${nLines} line(s) of ${roles.body}px text). Raise it or shorten the text`);
        // a rowCurve row grows so its curve (at least CURVE_MIN tall) fits under the tallest data value
        const dataLines = Math.max(0, ...placed.slice(1).map(c => c.lines.length));
        const h = Math.max(fixed ?? need, curve ? padY + dataLines * lineH(roles.body) + 8 + CURVE_MIN + 10 : 0);
        // fixed-height rows centre their text; content-height rows keep it top-aligned (the output before cellH existed)
        for (const c of placed)
            c.top = fixed === undefined || c.vAlign === 'top' ? cy + padY : cy + (h - c.lines.length * lineH(roles.body)) / 2;
        const row = { y: cy, h, cells: placed, header, tone };
        cy += h;
        return row;
    };
    const rows = [];
    const hasHeader = cols.some(c => c.label) && band.header !== false;
    if (hasHeader)
        rows.push(rowOf(cols, true));
    for (const [i, r] of band.rows.entries()) {
        const cells = 'cells' in r ? r.cells : r;
        rows.push(rowOf(cells, false, 'cells' in r ? r.tone : undefined, 'cells' in r ? r.h : undefined, band.rowCurve?.row === i));
    }
    let rowCurve;
    if (band.rowCurve) {
        const body = rows.filter(r => !r.header), row = body[band.rowCurve.row];
        if (!row)
            throw new Error(`table(): rowCurve row ${band.rowCurve.row} does not exist`);
        if (band.rowCurve.values.length !== cols.length - 1)
            throw new Error(`table(): rowCurve has ${band.rowCurve.values.length} values for ${cols.length - 1} data columns`);
        // below the data cells' own text (a wrapped value would otherwise run into the curve)
        const textBottom = Math.max(row.y, ...row.cells.slice(1).map(c => c.top + c.lines.length * lineH(roles.body)));
        const top = Math.max(row.y + row.h * 0.5, textBottom + 8), bottom = row.y + row.h - 10;
        const span = band.rowCurve.max - band.rowCurve.min;
        const yOf = (v) => bottom - (v - must(band.rowCurve).min) / span * (bottom - top);
        rowCurve = {
            points: band.rowCurve.values.map((v, i) => ({ x: must(colX[i + 1]) + must(colW[i + 1]) / 2, y: yOf(v) })),
            midY: yOf((band.rowCurve.min + band.rowCurve.max) / 2), top, bottom,
        };
    }
    return { type: 'table', id: band.id, x: left, y, w: tw, h: cy - y, titleBar, rows, colX, colW, tone: band.tone, rowHeader: band.rowHeader || undefined, reveal: band.reveal, ...(band.until === undefined ? {} : { until: band.until }), bodySize: roles.body, ...(rowCurve ? { rowCurve } : {}) };
}
