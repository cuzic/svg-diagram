import { markPlacedSource } from './layout-ctx.js';
import { sourceOf } from './source-ref.js';
import { groupTitleBand, snapGrid, stampChipW, STAMP_GAP, STAMP_H } from './layout-util.js';
import { lineWidth } from './layout-text.js';
/** Least room (px) a row's stretch must leave a group's content before the content is moved: under it, the content stays at the top. */
export const GROUP_FILL_MIN = 16;
const GROUP_FILL_GRID = 4;
const GROUP_GAP_GROW_MAX = 16;
/**
 * How `slack` px are shared inside a group of `n` children: each of the n-1 gaps grows by up to 16px (in 4px steps), and what is
 * still left is split above and below, the top part on the grid.
 */
export function groupFillPlan(n, slack) {
    const floor4 = (v) => Math.floor(v / GROUP_FILL_GRID) * GROUP_FILL_GRID;
    const gap = n > 1 ? Math.min(GROUP_GAP_GROW_MAX, floor4(slack / (n - 1))) : 0;
    return { gap, top: floor4((slack - gap * (n - 1)) / 2) };
}
export function layoutGroup(band, ctx, padX, cw) {
    layoutGroupAt(band, ctx, padX, cw);
}
export function layoutGroupAt(band, ctx, padX, cw, fill) {
    const { d, roles, widthOf } = ctx;
    const gp = band.pad ?? 16;
    const top0 = ctx.y, startY = snapGrid(top0); // the frame sits on the grid; the cursor moves on from where it was (no drift)
    const frame = { type: 'group', x: padX, y: startY, w: cw, h: 0, tone: band.tone, dashed: band.dashed, frame: band.frame, id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : { until: band.until }) };
    const at = ctx.laidOut.length;
    ctx.laidOut.push(frame); // pushed first so the frame is drawn under its children
    ctx.y += gp;
    if (band.title) {
        const t = ctx.placeBoxLike({ ...groupTitleBand(band), reveal: band.reveal, ...(band.until === undefined ? {} : { until: band.until }) }, padX + gp, ctx.y, cw - 2 * gp, false);
        const inkW = Math.max(0, ...t.wrappedRuns.flatMap(r => r.lines.map((_, i) => lineWidth(widthOf, r, i))));
        const inkX = t.align === 'center' ? t.x + (t.w - inkW) / 2 : t.align === 'right' ? t.x + t.w - inkW : t.x;
        t.inkBox = { x: inkX, y: t.y, w: inkW, h: t.h };
        frame.title = t.text;
        ctx.laidOut.push(t);
        ctx.y += t.h + d.gap / 2;
    }
    const only = band.children.length === 1 ? band.children[0] : undefined;
    const stretchOnly = fill?.valign === 'stretch' && only?.type === 'box';
    const plan = fill && !stretchOnly ? groupFillPlan(band.children.length, fill.slack) : { top: 0, gap: 0 };
    ctx.y += plan.top;
    band.children.forEach((c, i) => {
        ctx.stack([c], padX + gp, cw - 2 * gp);
        if (i < band.children.length - 1)
            ctx.y += plan.gap;
    });
    if (fill && stretchOnly) { // the single box takes the whole room
        const box = ctx.laidOut[ctx.laidOut.length - 1];
        box.h += fill.slack;
        ctx.y += fill.slack;
        if (box.id)
            ctx.setBox(box.id, box, box.h);
    }
    ctx.y = ctx.y - d.gap + gp;
    if (band.stamp) {
        frame.stamp = band.stamp;
        frame.stampW = stampChipW(widthOf, band.stamp, roles);
        if (frame.stampW > cw - 16)
            throw new Error(`stamp "${band.stamp}" is wider than its group (${Math.round(cw)}px): shorten it or widen the group`);
        ctx.y += STAMP_H + STAMP_GAP;
    }
    frame.h = ctx.y - top0;
    frame.span = ctx.laidOut.length - at - 1; // its title and contents, nested groups and their contents included (ADR 0054 D5)
    if (fill)
        frame.h += fill.slack - (stretchOnly ? fill.slack : plan.top + plan.gap * (band.children.length - 1)); // what is left goes under the content
    ctx.y = top0 + frame.h; // (the contents were laid out from the cursor itself, not from the snapped top: only the frame is placed on the grid)
    if (band.id) {
        if (ctx.anchors.has(band.id))
            ctx.claimed(band.id, 'a group takes an id that another box, group or row already has');
        ctx.anchors.set(band.id, { x: frame.x, y: frame.y, w: frame.w, h: frame.h });
    }
    ctx.y += d.gap;
    // A container may call layoutGroupAt directly to stretch this group.
    if (fill)
        markPlacedSource(ctx.laidOut, at, sourceOf(band));
}
