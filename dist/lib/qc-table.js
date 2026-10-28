import { must } from './must.js';
/** The tally marks of the Japanese check sheet: 一 丅 下 止 are 1 to 4 strokes, 正 is 5 (and is written again for the next five). */
export function tally(n) {
    if (!(Number.isInteger(n) && n >= 0))
        throw new Error(`tally(n): n must be a whole number >= 0 (got ${n})`);
    return '正'.repeat(Math.floor(n / 5)) + ['', '一', '丅', '下', '止'][n % 5];
}
export function checkSheetParts(items, columns, opts = {}) {
    if (!Array.isArray(items) || items.length === 0)
        throw new Error('checkSheet(items, columns) needs at least one item');
    if (!Array.isArray(columns) || columns.length === 0)
        throw new Error('checkSheet(items, columns) needs at least one column');
    const rows = items.map(i => typeof i === 'string' ? { label: i } : i);
    for (const r of rows) {
        if (typeof r.label !== 'string' || !r.label.trim())
            throw new Error('checkSheet(): every item needs a label');
        if (r.counts !== undefined && r.counts.length !== columns.length)
            throw new Error(`checkSheet(): item "${r.label}" has ${r.counts.length} counts for ${columns.length} columns`);
        if (r.counts?.some((c) => !(Number.isInteger(c) && c >= 0)))
            throw new Error(`checkSheet(): the counts of "${r.label}" must be whole numbers >= 0`);
    }
    if (opts.as !== undefined && !['tally', 'number', 'both'].includes(opts.as))
        throw new Error(`checkSheet(): as must be 'tally', 'number' or 'both' (got ${String(opts.as)})`);
    const counted = rows.some(r => r.counts !== undefined), as = opts.as ?? 'tally';
    const withTotal = opts.total ?? counted;
    if (withTotal && !counted)
        throw new Error('checkSheet(): total needs counts');
    const text = (n) => n === 0 ? '' : as === 'number' ? String(n) : as === 'both' ? `${tally(n)} ${n}` : tally(n);
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    const cols = [{ label: opts.corner ?? '', flex: 2, bold: true }, ...columns.map(label => ({ label, flex: 1, align: 'center' })), ...(withTotal ? [{ label: '計', flex: 1, align: 'center', bold: true }] : [])];
    const body = rows.map(r => [
        r.label,
        ...columns.map((_, j) => r.counts ? text(r.counts[j]) : opts.boxes ? '☐' : ''),
        ...(withTotal ? [{ text: r.counts ? String(sum(r.counts)) : '', bold: true }] : []),
    ]);
    if (withTotal) {
        const per = columns.map((_, j) => sum(rows.map(r => r.counts?.[j] ?? 0)));
        body.push({ cells: ['計', ...per.map(n => ({ text: String(n), bold: true })), { text: String(sum(per)), bold: true }], tone: 'muted' });
    }
    const { corner: _c, as: _a, total: _t, boxes: _b, ...rest } = opts;
    return { columns: cols, rows: body, opts: { ...rest, rowHeader: true } };
}
const GLYPH_MARK = { '◎': 'best', '○': 'ok', '△': 'mid', '×': 'ng' };
const VALUES = { best: 9, ok: 3, mid: 1, ng: 0 };
export const markOf = (m, where) => {
    if (m === undefined || m === '')
        return undefined;
    const k = GLYPH_MARK[m] ?? m;
    if (!['best', 'ok', 'mid', 'ng'].includes(k))
        throw new Error(`matrix(): ${where} has mark ${JSON.stringify(m)} (use ◎ ○ △ × or best / ok / mid / ng)`);
    return k;
};
/** The scores of the rows, from the marks and the weights. */
export function matrixScores(marks, weights, values = {}) {
    const v = { ...VALUES, ...values };
    return marks.map(r => r.reduce((n, m, j) => n + (m ? v[m] : 0) * (weights?.[j] ?? 1), 0));
}
export function matrixParts(rowLabels, colLabels, cells, opts = {}) {
    if (!Array.isArray(rowLabels) || rowLabels.length === 0)
        throw new Error('matrix(rows, cols, cells) needs at least one row');
    if (!Array.isArray(colLabels) || colLabels.length === 0)
        throw new Error('matrix(rows, cols, cells) needs at least one column');
    if (cells.length !== rowLabels.length)
        throw new Error(`matrix(): cells has ${cells.length} rows for ${rowLabels.length} row labels`);
    const marks = cells.map((r, i) => {
        if (r.length !== colLabels.length)
            throw new Error(`matrix(): row "${rowLabels[i]}" has ${r.length} cells for ${colLabels.length} columns`);
        return r.map((m, j) => markOf(m, `the cell of "${rowLabels[i]}" x "${colLabels[j]}"`));
    });
    const { weights } = opts;
    if (weights !== undefined) {
        if (weights.length !== colLabels.length)
            throw new Error(`matrix(): weights has ${weights.length} numbers for ${colLabels.length} columns`);
        if (!weights.every(w => Number.isFinite(w) && w >= 0))
            throw new Error('matrix(): every weight must be a number >= 0');
    }
    for (const [k, v] of Object.entries(opts.values ?? {}))
        if (!['best', 'ok', 'mid', 'ng'].includes(k) || !Number.isFinite(v))
            throw new Error(`matrix(): values has ${k}: ${v} (keys best / ok / mid / ng, numbers)`);
    const withTotal = opts.total ?? weights !== undefined;
    const scores = matrixScores(marks, weights, opts.values), top = Math.max(...scores), best = top > 0 && scores.filter(v => v === top).length === 1; // a tie, or nothing scored, has no best row
    const cols = [{ label: opts.corner ?? '', flex: 2, bold: true }, ...colLabels.map(label => ({ label, flex: 1, align: 'center' })), ...(withTotal ? [{ label: weights ? '評価点' : '合計', flex: 1, align: 'center', bold: true }] : [])];
    const rows = [];
    if (weights)
        rows.push({ cells: ['重み', ...weights.map(w => ({ text: String(w), align: 'center', tone: 'muted' })), ...(withTotal ? [''] : [])], tone: 'muted' });
    rowLabels.forEach((label, i) => rows.push([
        label,
        ...must(marks[i]).map((m) => m ? { text: '', mark: m, align: 'center' } : { text: '', align: 'center' }),
        ...(withTotal ? [best && scores[i] === top && opts.highlight !== false && rowLabels.length > 1 ? { text: String(scores[i]), tone: 'accent', bold: true, mark: 'best', align: 'center' } : { text: String(scores[i]), align: 'center' }] : []),
    ]));
    const { corner: _c, weights: _w, values: _v, total: _t, highlight: _h, ...rest } = opts;
    return { columns: cols, rows, opts: { ...rest, rowHeader: true } };
}
