import {areasColumns} from './areas.ts';
import {canvasRowHeights, canvasSpan, trackRowYs} from './canvas.ts';
import {restoreCtx, snapshotCtx} from './layout-ctx.ts';
import type {LayoutCtx} from './layout-ctx.ts';
import {GROUP_FILL_MIN, layoutGroupAt} from './layout-group.ts';
import type {GroupFill} from './layout-group.ts';
import {CANVAS_MIN_REGION_W} from './layout-util.ts';
import {must} from './must.ts';
import type {AreasBand, LaidOutGroup, LaidOutRow} from './types/containers.ts';

// areas() (ADR 0069 D3): every named area is laid out at its columns' x and width (areasColumns; the rows share canvas()'s track geometry), first from the top to measure what it needs, then
// (taken back and laid out again) at its rows' y. A row is as tall as its tallest one-row area, an area spanning rows as tall as those
// rows; a box is stretched to its area and a group's frame too, the room handed to its content as in a row (#377: a framed group is
// centred by default, a frameless one only with valign). Only the band types a row already emits come out (a box in a LaidOutRow).
export function layoutAreas(band: AreasBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx;
  const {gap, rowGap} = ctx.areasGapFor(band, cw);
  const cols = areasColumns(band.colW, padX, cw, gap);
  const cells = band.children.map((_c, i) => {
    const s = canvasSpan(cols, must(band.place[i]));
    // per area, not per column: a column of empty cells (.) is a spacer and may be as narrow as its ratio makes it
    if (s.w < CANVAS_MIN_REGION_W) throw new Error(`areas: area "${band.names[i]}" is only ${Math.max(0, Math.round(s.w))}px wide (at least ${CANVAS_MIN_REGION_W}px): give its columns a larger share (cols), use a smaller gap, or widen the figure (diagram({width}))`);
    return s;
  });
  const top = Math.ceil(ctx.y / 4 - 1e-6) * 4; // on the 4px grid (gap and rowGap are multiples of 4): every row edge is too
  const before = snapshotCtx(ctx);
  const needs = band.children.map((c, i) => {
    const s = must(cells[i]);
    ctx.y = top;
    if (c.type === 'box') return ctx.placeBoxLike(c, s.x, top, s.w, true).h;
    const at = ctx.laidOut.length;
    ctx.stack([c], s.x, s.w);
    return (ctx.laidOut[at] as LaidOutGroup).h; // ctx.stack() pushes a group's frame first
  });
  restoreCtx(ctx, before); // take back the ids and connectors the measuring registered
  const rows = canvasRowHeights(band, needs, rowGap, 0), ys = trackRowYs(top, rows, rowGap);
  band.children.forEach((c, i) => {
    const s = must(cells[i]), p = must(band.place[i]), y = must(ys[p.row]), h = must(ys[p.row + p.rs]) - rowGap - y;
    ctx.y = y;
    if (c.type === 'box') {
      const b = ctx.placeBoxLike(c, s.x, y, s.w, true);
      b.h = h;
      if (b.id) ctx.setBox(b.id, b as never, h);
      ctx.laidOut.push({type: 'row', x: s.x, y, w: s.w, h, children: [b], arrows: []} satisfies LaidOutRow);
      return;
    }
    const slack = h - must(needs[i]);
    const fill: GroupFill | undefined = c.valign === 'top' || (c.frame === false && c.valign === undefined) || slack < GROUP_FILL_MIN ? undefined : {slack, valign: c.valign ?? 'center'};
    const at = ctx.laidOut.length;
    if (fill) layoutGroupAt(c, ctx, s.x, s.w, fill); else ctx.stack([c], s.x, s.w);
    const f = ctx.laidOut[at] as LaidOutGroup;
    f.h = h;
    if (c.id) ctx.anchors.set(c.id, {x: f.x, y: f.y, w: f.w, h});
  });
  const bottom = must(ys[rows.length]) - rowGap;
  if (band.id) {
    if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'an areas() takes an id that another box, group or row already has');
    ctx.anchors.set(band.id, {x: padX, y: top, w: cw, h: bottom - top});
    ctx.areaIds.add(band.id); // the boxes in it count as its end (as with row({id}))
  }
  ctx.y = bottom + d.gap;
}
