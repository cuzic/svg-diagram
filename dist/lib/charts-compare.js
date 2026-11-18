// compare(): a comparison table (比較表 / 比較マトリクス) with a rating and its reason in every cell. Each cell is split by a dashed line: the
// rating (◎ ○ △ ×) centred on the left, the reason on the right, so that the ratings read down a column at a glance. matrix() is the same
// table without the reasons (and with scores).
import { must } from './must.js';
import { checkText, fail } from './charts-base.js';
import { layoutRatingTable } from './charts-rating-table.js';
import { markOf } from './qc-table.js';
import { CELL_MARKS } from './tokens.js';
export function resolveCompare(rows, cols, cells, opts = {}) {
    if (!Array.isArray(rows) || rows.length === 0)
        fail('compare', 'needs at least one row');
    if (!Array.isArray(cols) || cols.length === 0)
        fail('compare', 'needs at least one column');
    if (rows.length > 12 || cols.length > 6)
        fail('compare', 'is limited to 12 rows and 6 columns (every cell holds a sentence)');
    rows.forEach((r, i) => checkText('compare', `row ${i + 1}`, r));
    cols.forEach((k, j) => checkText('compare', `column ${j + 1}`, k));
    if (new Set(rows).size !== rows.length || new Set(cols).size !== cols.length)
        fail('compare', 'row names and column names must each be unique');
    if (!Array.isArray(cells) || cells.length !== rows.length)
        fail('compare', `cells needs ${rows.length} rows (one per row name), got ${Array.isArray(cells) ? cells.length : 'none'}`);
    const grid = cells.map((r, i) => {
        if (!Array.isArray(r) || r.length !== cols.length)
            fail('compare', `row "${rows[i]}" needs ${cols.length} cells (one per column), got ${Array.isArray(r) ? r.length : 'none'}`);
        return r.map((cell, j) => {
            if (cell === null)
                return null;
            const where = `"${rows[i]}" / "${cols[j]}"`;
            if (!Array.isArray(cell) || cell.length !== 2)
                fail('compare', `${where} must be [mark, note] or null (a table of marks alone is matrix())`);
            const [m, note] = cell;
            return { mark: markIn(m, where), note: checkText('compare', `the note of ${where}`, note) };
        });
    });
    return { rows: [...rows], cols: [...cols], cells: grid, corner: opts.corner ?? '' };
}
function markIn(m, where) {
    const mark = (() => {
        try {
            return markOf(m, where);
        }
        catch (e) {
            return fail('compare', e.message.replace(/^matrix\(\):\s*/, ''));
        }
    })();
    return mark ?? fail('compare', `${where} has no mark (use ◎ ○ △ × or best / ok / mid / ng; null for a cell that is not rated)`);
}
export function compareAlt(s) {
    return `比較表: ${s.rows.map((r, i) => `${r}: ${s.cols.map((k, j) => { const c = must(s.cells[i])[j]; return `${k} ${c ? `${CELL_MARKS[c.mark].glyph} ${c.note}` : '未評価'}`; }).join('、')}`).join(' / ')}`;
}
export function compareTexts(s) {
    const out = [['—', 400]];
    for (const r of s.rows)
        out.push([r, 400], [r, 700]);
    for (const k of s.cols)
        out.push([k, 700]);
    if (s.corner)
        out.push([s.corner, 400]);
    for (const c of s.cells.flat())
        if (c)
            out.push([CELL_MARKS[c.mark].glyph, CELL_MARKS[c.mark].bold ? 700 : 400], [c.note, 400]);
    return out;
}
export function layoutCompare(s, g) {
    const cells = s.cells.map(r => r.map(c => c ? { rating: c.mark, note: c.note } : null));
    return layoutRatingTable({ rows: s.rows, cols: s.cols, cells, corner: s.corner, ruled: true }, {
        who: 'compare', ratingW: Math.max(36, Math.ceil(g.size * 2.6)), ratingH: Math.round(g.size * 1.25) + 16,
        draw: (c, cx, cy, mark, of) => { const m = CELL_MARKS[mark]; c.text(m.glyph, cx, c.mid(cy), 'middle', m.tone, { bold: m.bold, of }); },
    }, g);
}
