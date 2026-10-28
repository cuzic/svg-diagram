// harvey(): a table of Harvey balls (ハーベイボール): each cell is a circle filled by a quarter, a half, three quarters or fully, the
// usual way a consulting slide rates options against criteria. The fill is a shape (a wedge), never just a colour, and the scale is
// written under the table; the values are listed in the description.
import { must } from './must.js';
import { Canvas, checkIds, checkText, fail, finiteNum } from './charts-base.js';
export function resolveHarvey(rowsIn, cols, values, opts = {}) {
    if (!Array.isArray(rowsIn) || rowsIn.length === 0)
        fail('harvey', 'needs at least one row');
    const rows = rowsIn.map(r => typeof r === 'string' ? r : r.label), rowIds = rowsIn.map(r => typeof r === 'string' ? undefined : r.id);
    checkIds('harvey', rowIds, opts.id);
    if (!Array.isArray(cols) || cols.length === 0)
        fail('harvey', 'needs at least one column');
    if (rows.length > 20 || cols.length > 10)
        fail('harvey', 'is limited to 20 rows and 10 columns (it is a table of symbols to read at a glance)');
    rows.forEach((r, i) => checkText('harvey', `row ${i + 1}`, r));
    cols.forEach((r, i) => checkText('harvey', `column ${i + 1}`, r));
    if (new Set(rows).size !== rows.length || new Set(cols).size !== cols.length)
        fail('harvey', 'row names and column names must each be unique');
    if (!Array.isArray(values) || values.length !== rows.length)
        fail('harvey', `values needs ${rows.length} rows (one per row name), got ${Array.isArray(values) ? values.length : 'none'}`);
    const grid = values.map((r, i) => {
        if (!Array.isArray(r) || r.length !== cols.length)
            fail('harvey', `row "${rows[i]}" needs ${cols.length} values (one per column), got ${Array.isArray(r) ? r.length : 'none'}`);
        return r.map((v, j) => {
            if (v === null)
                return null;
            finiteNum('harvey', `"${rows[i]}" / "${cols[j]}"`, v);
            if (![0, 1, 2, 3, 4].includes(v))
                fail('harvey', `"${rows[i]}" / "${cols[j]}" must be 0, 1, 2, 3 or 4 (quarters filled; null for not rated), got ${v}`);
            return v;
        });
    });
    const levels = opts.levels === undefined ? ['なし', '一部', '半分', 'ほぼ', '十分'] : [...opts.levels];
    if (levels.length !== 5)
        fail('harvey', 'levels needs 5 names, from empty to full');
    levels.forEach((l, i) => checkText('harvey', `levels[${i}]`, l));
    for (const h of opts.highlight ?? [])
        if (!cols.includes(h))
            fail('harvey', `highlight "${h}" is not a column name`);
    return { rows, rowIds, cols: [...cols], values: grid, levels, corner: opts.corner ?? '', highlight: [...(opts.highlight ?? [])] };
}
export function harveyAlt(s) {
    return `ハーベイボール（${s.levels.map((l, i) => `${i}/4 = ${l}`).join('、')}）: ${s.rows.map((r, i) => `${r}: ${s.cols.map((c, j) => `${c} ${must(s.values[i])[j] === null ? '未評価' : must(s.levels[must(must(s.values[i])[j])])}`).join('、')}`).join(' / ')}`;
}
export function harveyTexts(s) {
    const out = [];
    for (const r of s.rows)
        out.push([r, 400], [r, 700]);
    for (const c of s.cols)
        out.push([c, 400], [c, 700]);
    if (s.corner)
        out.push([s.corner, 400]);
    out.push(['—', 400], ['未評価', 400]);
    for (const l of s.levels)
        out.push([l, 400]);
    return out;
}
/** The path of a Harvey ball's filled part: `q` quarters, from 12 o'clock clockwise. */
export function harveyWedge(cx, cy, r, q) {
    const f = (v) => Math.round(v * 10) / 10;
    if (q <= 0)
        return '';
    if (q >= 4)
        return `M${f(cx - r)},${f(cy)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
    const a = q * Math.PI / 2, x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
    return `M${f(cx)},${f(cy)} L${f(cx)},${f(cy - r)} A${r},${r} 0 ${q > 2 ? 1 : 0},1 ${f(x)},${f(y)} Z`;
}
export function layoutHarvey(s, g) {
    const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf, g.wrap), lh = c.lineH(), r1 = (v) => Math.round(v * 10) / 10;
    const R = Math.max(12, Math.ceil(S * 0.9)), cellH = 2 * R + 16;
    const rowW = Math.min(Math.max(...s.rows.map(r => c.tw(r)), s.corner ? c.tw(s.corner) : 0) + 16, g.w * 0.38);
    const colW = (g.w - rowW) / s.cols.length;
    if (colW < 2 * R + 12)
        fail('harvey', `${s.cols.length} columns do not fit in ${Math.round(g.w)}px (raise width, or use fewer columns)`);
    const heads = s.cols.map(k => c.wrap(k, colW - 8, s.highlight.includes(k))), rowsW = s.rows.map(r => c.wrap(r, rowW - 16));
    for (const [i, ls] of heads.entries())
        for (const l of ls)
            if (c.tw(l, s.highlight.includes(must(s.cols[i]))) > colW - 4)
                fail('harvey', `the column name "${s.cols[i]}" is too long for ${Math.round(colW)}px (shorten it, or raise width)`);
    const corner = s.corner ? c.wrap(s.corner, rowW - 8) : [];
    const headH = Math.max(corner.length, ...heads.map(l => l.length)) * lh + 12;
    const rowH = rowsW.map(l => Math.max(cellH, l.length * lh + 10));
    const bodyT = g.y + headH, bodyB = bodyT + rowH.reduce((a, b) => a + b, 0), legendH = 2 * R + 18;
    c.h = g.height ?? headH + (bodyB - bodyT) + legendH + 8;
    if (g.height !== undefined && g.height < bodyB - g.y + legendH)
        fail('harvey', `height ${g.height} is too small for ${s.rows.length} rows (need at least ${Math.ceil(bodyB - g.y + legendH)})`);
    const left = g.x + rowW;
    // highlighted columns are boxed under everything else
    s.cols.forEach((k, j) => { if (s.highlight.includes(k))
        c.rect(r1(left + j * colW + 2), g.y, r1(colW - 4), r1(bodyB - g.y), { fill: 'accent', op: 0.08, stroke: 'accent', sw: 2 }); });
    if (corner.length)
        c.lines(corner, g.x + 4, g.y + headH - 8 - (corner.length - 1) * lh, 'start', 'muted');
    s.cols.forEach((k, j) => { const hd = must(heads[j]); c.lines(hd, left + (j + 0.5) * colW, g.y + headH - 8 - (hd.length - 1) * lh, 'middle', 'text', { bold: s.highlight.includes(k) }); });
    c.line(g.x, bodyT, g.x + g.w, bodyT, { stroke: 'text' });
    let y = bodyT;
    s.rows.forEach((_r, i) => {
        const rh = must(rowH[i]), rw = must(rowsW[i]), vrow = must(s.values[i]), rid = s.rowIds[i];
        const cy = y + rh / 2;
        const key = s.rowIds[i] ?? `#${i}`;
        c.lines(rw, g.x + 4, cy - (rw.length - 1) * lh / 2 + S * 0.36, 'start', 'text', { bold: true, of: key });
        if (rid)
            c.anchors.push({ id: rid, x: g.x, y: r1(y), w: g.w, h: rh });
        s.cols.forEach((_k, j) => {
            const cx = left + (j + 0.5) * colW, v = vrow[j];
            if (v === null) {
                c.text('—', cx, c.mid(cy), 'middle', 'muted', { of: key });
                return;
            }
            if (v === undefined)
                return;
            ball(c, cx, cy, R, v, key);
        });
        y += rh;
        c.line(g.x, y, g.x + g.w, y, { stroke: i === s.rows.length - 1 ? 'text' : 'border' });
    });
    // legend: the five balls with their names, in a row (it fails when the width is short)
    const lr = Math.round(R * 0.62), item = (t) => 2 * lr + 6 + c.tw(t), gap = 20;
    let lx = g.x + 4, ly = bodyB + 8 + lr + 4;
    const total = s.levels.reduce((a, t) => a + item(t) + gap, -gap);
    if (total > g.w)
        fail('harvey', 'the legend does not fit (shorten the level names, or raise width)');
    s.levels.forEach((t, q) => { ball(c, lx + lr, ly, lr, q); c.text(t, lx + 2 * lr + 6, c.mid(ly), 'start', 'text'); lx += item(t) + gap; });
    void ly;
    return c.done();
}
function ball(c, cx, cy, r, q, of) {
    const f = (v) => Math.round(v * 10) / 10;
    c.path(`M${f(cx - r)},${f(cy)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`, { fill: 'bg', stroke: 'text', sw: 2, of });
    if (q > 0)
        c.path(harveyWedge(cx, cy, r, q), { fill: 'text', stroke: 'text', sw: 2, of });
}
