import { snapshotCtx, restoreCtx } from './layout-ctx.js';
import { GROUP_FILL_MIN, layoutGroupAt } from './layout-group.js';
import { rowChildGeometry, snapGrid } from './layout-util.js';
import { registerRowSlots } from './layout-row.js';
import { must } from './must.js';
export function layoutGroupRow(band, ctx, padX, cw) {
    const { d } = ctx;
    // Each child is laid out as if stacked alone at its own x / width, all starting at the row's top; afterwards every
    // frame / box is stretched to the tallest one. A framed group left GROUP_FILL_MIN px or more of room by that stretch is laid
    // out again with the room handed to its content (centred by default; group({valign}) changes it: ADR 0014 D2).
    const rowGap = ctx.gapForLabels(band, cw);
    const { widths, xOffsets } = rowChildGeometry({ ...band, gap: rowGap }, cw);
    const top0 = ctx.y, rowTop = snapGrid(top0); // on the grid; the cursor moves on from where it was (no drift)
    const before = snapshotCtx(ctx);
    const place = (fills) => {
        const stretch = [], natural = [];
        let rowHeight = 0;
        band.children.forEach((child, i) => {
            ctx.y = top0;
            const x = padX + must(xOffsets[i]), w = must(widths[i]);
            if (child.type === 'box') {
                const c = ctx.placeBoxLike(child, x, rowTop, w, true);
                const rw = { type: 'row', x, y: rowTop, w, h: c.h, children: [c], arrows: [] };
                ctx.laidOut.push(rw);
                natural.push(c.h);
                rowHeight = Math.max(rowHeight, c.h);
                stretch.push(h => { c.h = rw.h = h; if (c.id)
                    ctx.setBox(c.id, c, h); });
            }
            else {
                const frame = ctx.laidOut.length, fill = fills[i];
                if (fill)
                    layoutGroupAt(child, ctx, x, w, fill);
                else
                    ctx.stack([child], x, w);
                const f = ctx.laidOut[frame]; // ctx.stack() pushes a group's frame first
                natural.push(f.h);
                rowHeight = Math.max(rowHeight, f.h);
                stretch.push(h => { f.h = h; if (child.id)
                    ctx.anchors.set(child.id, { x: f.x, y: f.y, w: f.w, h }); });
            }
        });
        return { rowHeight, natural, stretch };
    };
    let placed = place([]);
    const fills = band.children.map((c, i) => {
        // a frameless group (also what a caption / table in a row is wrapped in) stays at the top unless it asks for a valign
        if (c.type !== 'group' || c.valign === 'top' || (c.frame === false && c.valign === undefined))
            return undefined;
        const slack = placed.rowHeight - must(placed.natural[i]);
        return slack >= GROUP_FILL_MIN ? { slack, valign: c.valign ?? 'center' } : undefined;
    });
    if (fills.some(Boolean)) { // start the row over: take back what the first pass registered (ids, connectors), then lay it out with the room
        restoreCtx(ctx, before);
        placed = place(fills);
    }
    const { rowHeight, stretch } = placed;
    stretch.forEach(s => s(rowHeight));
    registerRowSlots(ctx, band.id, band, rowTop, rowHeight, padX, cw, rowGap, widths.map((w, i) => ({ x: padX + must(xOffsets[i]), y: rowTop, w, h: rowHeight })));
    ctx.y = top0 + rowHeight + d.gap;
}
