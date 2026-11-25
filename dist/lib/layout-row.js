import { gridColumns, rowChildGeometry, snapGrid } from './layout-util.js';
import { must } from './must.js';
// row({id}): the row itself is an anchor, and so is each of its columns (`id#5`, `id#5-6`; the n-th child on a row without `cols`).
export function registerRowSlots(ctx, id, band, rowTop, rowHeight, padX, cw, gap, placed) {
    if (!id)
        return;
    if (ctx.anchors.has(id))
        ctx.claimed(id, 'a row takes an id that another box, group or row already has');
    ctx.anchors.set(id, { x: padX, y: rowTop, w: cw, h: rowHeight });
    ctx.areaIds.add(id);
    if (band.cols) {
        const cols = band.cols, colW = (cw - (cols - 1) * gap) / cols, grid = gridColumns(cw, cols, gap, { centerGutter: cols === 12 }); // the same column edges the row's children sit on
        const left = (c) => grid ? must(grid.x[c]) : c * (colW + gap), right = (c) => grid ? must(grid.x[c]) + must(grid.w[c]) : c * (colW + gap) + colW;
        for (let a = 1; a <= cols; a++)
            for (let b = a; b <= cols; b++) {
                const key = b === a ? `${id}#${a}` : `${id}#${a}-${b}`;
                if (ctx.anchors.has(key))
                    ctx.claimed(key, 'a row column collides with an existing id');
                ctx.anchors.set(key, { x: padX + left(a - 1), y: rowTop, w: right(b - 1) - left(a - 1), h: rowHeight });
                ctx.areaIds.add(key);
            }
    }
    else {
        const put = (key, r) => { if (ctx.anchors.has(key))
            ctx.claimed(key, 'a row column collides with an existing id'); ctx.anchors.set(key, r); ctx.areaIds.add(key); };
        placed.forEach((r, i) => put(`${id}#${i + 1}`, { x: r.x, y: rowTop, w: r.w, h: rowHeight }));
        for (let a = 0; a < placed.length; a++)
            for (let b = a + 1; b < placed.length; b++)
                put(`${id}#${a + 1}-${b + 1}`, { x: must(placed[a]).x, y: rowTop, w: must(placed[b]).x + must(placed[b]).w - must(placed[a]).x, h: rowHeight });
    }
}
export function layoutRow(band, ctx, padX, cw) {
    const { d } = ctx, top = snapGrid(ctx.y); // the row sits on the grid; the cursor moves on from where it was
    const rowGap = ctx.gapForLabels(band, cw);
    const { widths, xOffsets } = rowChildGeometry({ ...band, gap: rowGap }, cw);
    const placedChildren = band.children.map((child, i) => ctx.placeBoxLike(child, padX + must(xOffsets[i]), top, must(widths[i]), true));
    const rowHeight = Math.max(...placedChildren.map(c => c.h));
    for (const c of placedChildren) {
        c.h = rowHeight;
        if (c.id)
            ctx.setBox(c.id, c, rowHeight);
    }
    const arrows = [];
    if (band.arrows === 'between') {
        for (let i = 0; i < placedChildren.length - 1; i++) {
            const a = must(placedChildren[i]), b = must(placedChildren[i + 1]);
            const y = top + rowHeight / 2;
            arrows.push({ x1: a.x + a.w, y1: y, x2: b.x, y2: y });
        }
    }
    registerRowSlots(ctx, band.id, band, top, rowHeight, padX, cw, rowGap, placedChildren);
    ctx.laidOut.push({ type: 'row', id: band.id, x: padX, y: top, w: cw, h: rowHeight, children: placedChildren, arrows });
    ctx.y += rowHeight + d.gap;
}
