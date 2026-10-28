// clustermap(): seaborn's clustermap — a heatmap whose rows and columns are put in the order of a hierarchical clustering (average linkage on
// Euclidean distance), with the two dendrograms beside it. The tree is deterministic (lib/stats.ts averageLinkage), so the same table always
// comes out in the same order.
import { Canvas, checkIds, checkText, fail, finiteNum, inkOnShade, numText } from './charts-base.js';
import { must } from './must.js';
import { averageLinkage, dendrogramOrder } from './stats.js';
const MAX = 40;
const transpose = (m) => must(m[0]).map((_q, j) => m.map(r => must(r[j])));
const cell = (m, r, c) => must(must(m[r])[c]);
const minmax = (v) => { const lo = Math.min(...v), hi = Math.max(...v); return v.map(q => hi > lo ? (q - lo) / (hi - lo) : 0.5); };
export function resolveCluster(rows, cols, values, opts) {
    checkIds('clustermap', [], opts.id);
    if (!Array.isArray(rows) || rows.length < 2)
        fail('clustermap', 'needs at least two rows');
    if (!Array.isArray(cols) || cols.length < 2)
        fail('clustermap', 'needs at least two columns');
    if (rows.length > MAX || cols.length > MAX)
        fail('clustermap', `at most ${MAX} rows and ${MAX} columns (got ${rows.length} × ${cols.length})`);
    if (!Array.isArray(values) || values.length !== rows.length || values.some(r => !Array.isArray(r) || r.length !== cols.length))
        fail('clustermap', `values must be ${rows.length} rows of ${cols.length} numbers`);
    if (opts.scale !== undefined && opts.scale !== 'row' && opts.scale !== 'col')
        fail('clustermap', `scale must be 'row' or 'col' (got ${String(opts.scale)})`);
    rows.forEach((r, i) => checkText('clustermap', `row ${i + 1}'s name`, r));
    cols.forEach((c, i) => checkText('clustermap', `column ${i + 1}'s name`, c));
    const v = values.map((r, i) => r.map((q, j) => finiteNum('clustermap', `value (${rows[i]}, ${cols[j]})`, q)));
    const all = v.flat(), lo = Math.min(...all), hi = Math.max(...all);
    const shade = opts.scale === 'row' ? v.map(minmax) : opts.scale === 'col' ? transpose(transpose(v).map(minmax)) : v.map(r => r.map(q => hi > lo ? (q - lo) / (hi - lo) : 0.5));
    const tree = (data) => { const merges = averageLinkage(data); return { merges, ...dendrogramOrder(merges, data.length) }; };
    const rowTree = opts.rows === false ? undefined : tree(shade), colTree = opts.cols === false ? undefined : tree(transpose(shade));
    return { rows: [...rows], cols: [...cols], values: v, unit: opts.unit ?? '', ...(opts.scale ? { scale: opts.scale } : {}), showValues: opts.values ?? true, ...(rowTree ? { rowTree } : {}), ...(colTree ? { colTree } : {}), shade };
}
export function clusterAlt(s) {
    const ro = s.rowTree?.order ?? s.rows.map((_r, i) => i), co = s.colTree?.order ?? s.cols.map((_c, i) => i);
    return `クラスタ付きヒートマップ（行 ${ro.map(i => s.rows[i]).join('・')} / 列 ${co.map(i => s.cols[i]).join('・')}、値 ${numText(Math.min(...s.values.flat()))}〜${numText(Math.max(...s.values.flat()))}${s.unit}）`;
}
export function clusterTexts(s) {
    const all = s.values.flat(), out = [...s.rows, ...s.cols].map(t => [t, 400]);
    for (const v of all)
        out.push([`${numText(v)}${s.unit}`, 700]);
    out.push([`最小 ${numText(Math.min(...all))}${s.unit}`, 400], [`最大 ${numText(Math.max(...all))}${s.unit}`, 400]);
    return out;
}
export function layoutCluster(s, g) {
    const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf, g.wrap), lh = c.lineH(), r1 = (v) => Math.round(v * 10) / 10;
    const nr = s.rows.length, nc = s.cols.length, ro = s.rowTree?.order ?? s.rows.map((_r, i) => i), co = s.colTree?.order ?? s.cols.map((_q, i) => i);
    const rowW = Math.min(Math.max(...s.rows.map(t => c.tw(t))) + 12, g.w * 0.22), dw = s.rowTree ? 80 : 0, dh = s.colTree ? 64 : 0;
    const left = g.x + dw + 6, right = g.x + g.w - rowW - 4, cw = (right - left) / nc;
    if (cw < 14)
        fail('clustermap', 'the figure is too narrow for its columns (raise width, or use fewer columns)');
    const colLines = s.cols.map(t => c.wrap(t, cw - 4)), labH = Math.max(...colLines.map(l => l.length)) * lh + 10;
    const rh = Math.max(S + 6, 22), top = g.y + dh + 6;
    c.h = g.height ?? dh + 6 + nr * rh + labH + S + 30;
    const cellH = g.height !== undefined ? (c.h - dh - 6 - labH - S - 30) / nr : rh;
    if (cellH < S + 2)
        fail('clustermap', 'the figure is too short for its rows (raise height, or use fewer rows)');
    const lo = Math.min(...s.values.flat()), hi = Math.max(...s.values.flat());
    // cells, in the dendrogram order
    ro.forEach((ri, y) => co.forEach((ci, x) => {
        const t = cell(s.shade, ri, ci), op = r1(0.1 + 0.8 * t), ink = inkOnShade(op), text = `${numText(cell(s.values, ri, ci))}${s.unit}`;
        const host = c.rect(r1(left + x * cw), r1(top + y * cellH), r1(cw), r1(cellH), { fill: 'accent', op, stroke: 'bg', sw: 1, solid: `the cell (${s.rows[ri]}, ${s.cols[ci]})` });
        if (s.showValues && c.tw(text, true) + 6 <= cw && S + 2 <= cellH)
            c.text(text, left + (x + 0.5) * cw, c.mid(top + (y + 0.5) * cellH), 'middle', ink, { bold: true, host, on: { fill: 'accent', op, ink } });
    }));
    ro.forEach((ri, y) => c.text(must(s.rows[ri]), right + 8, c.mid(top + (y + 0.5) * cellH), 'start', 'text'));
    const gridB = top + nr * cellH;
    co.forEach((ci, x) => c.lines(must(colLines[ci]), left + (x + 0.5) * cw, gridB + S + 6, 'middle', 'text'));
    // dendrograms: the columns above, the rows to the left (heights run away from the cells)
    const tree = (t, n, along, away) => {
        const maxH = Math.max(...t.merges.map(m => m.height)) || 1, hOf = (id) => id < n ? 0 : must(t.merges[id - n]).height / maxH, seg = [];
        t.merges.forEach((m, k) => {
            const h = hOf(n + k);
            for (const ch of [m.a, m.b])
                seg.push(`M${r1(along(must(t.pos[ch])))},${r1(away(hOf(ch)))} L${r1(along(must(t.pos[ch])))},${r1(away(h))}`);
            seg.push(`M${r1(along(must(t.pos[m.a])))},${r1(away(h))} L${r1(along(must(t.pos[m.b])))},${r1(away(h))}`);
        });
        return seg;
    };
    if (s.colTree)
        c.path(tree(s.colTree, nc, p => left + (p + 0.5) * cw, h => g.y + dh - h * (dh - 4)).join(' '), { fill: 'none', stroke: 'text', sw: 1.5 });
    if (s.rowTree) {
        // rows: along = y (swap the pair order), away = x to the left
        const segs = tree(s.rowTree, nr, p => top + (p + 0.5) * cellH, h => left - 6 - h * (dw - 8)).map(q => q.replace(/(-?[\d.]+),(-?[\d.]+)/g, '$2,$1'));
        c.path(segs.join(' '), { fill: 'none', stroke: 'text', sw: 1.5 });
    }
    // the colour scale under the grid
    const legY = gridB + labH + 8;
    const minText = `最小 ${numText(lo)}${s.unit}`, sx0 = g.x + c.tw(minText) + 8;
    c.text(minText, g.x, c.mid(legY + 7), 'start', 'muted');
    for (let k = 0; k < 5; k++)
        c.rect(sx0 + k * 18, legY, 18, 14, { fill: 'accent', op: r1(0.1 + 0.8 * k / 4), stroke: 'border', sw: 1 });
    c.text(`最大 ${numText(hi)}${s.unit}`, sx0 + 5 * 18 + 8, c.mid(legY + 7), 'start', 'muted');
    c.h = Math.max(c.h, legY + 14 + 6 - g.y);
    void Canvas;
    return c.done();
}
