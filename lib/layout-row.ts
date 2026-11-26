import type {LayoutCtx, RowLike} from './layout-ctx.ts';
import {layoutBoxContent} from './layout-text.ts';
import {BOX_PAD_X, TOP_ICON_GAP, gridColumns, rowChildGeometry, snapGrid, stepBadgeGeom} from './layout-util.ts';
import {must} from './must.ts';
import type {RowArrow, RowBand} from './types/containers.ts';
import type {Rect} from './types/core.ts';
import type {BoxBand} from './types/text-bands.ts';

// row({id}): the row itself is an anchor, and so is each of its columns (`id#5`, `id#5-6`; the n-th child on a row without `cols`).
export function registerRowSlots(ctx: Pick<LayoutCtx, 'anchors' | 'areaIds' | 'claimed'>, id: string | undefined, band: RowLike, rowTop: number, rowHeight: number, padX: number, cw: number, gap: number, placed: Rect[]): void {
  if (!id) return;
  if (ctx.anchors.has(id)) ctx.claimed(id, 'a row takes an id that another box, group or row already has');
  ctx.anchors.set(id, {x: padX, y: rowTop, w: cw, h: rowHeight});
  ctx.areaIds.add(id);
  if (band.cols) {
    const cols = band.cols, colW = (cw - (cols - 1) * gap) / cols, grid = gridColumns(cw, cols, gap, {centerGutter: cols === 12}); // the same column edges the row's children sit on
    const left = (c: number): number => grid ? must(grid.x[c]) : c * (colW + gap), right = (c: number): number => grid ? must(grid.x[c]) + must(grid.w[c]) : c * (colW + gap) + colW;
    for (let a = 1; a <= cols; a++) for (let b = a; b <= cols; b++) {
      const key = b === a ? `${id}#${a}` : `${id}#${a}-${b}`;
      if (ctx.anchors.has(key)) ctx.claimed(key, 'a row column collides with an existing id');
      ctx.anchors.set(key, {x: padX + left(a - 1), y: rowTop, w: right(b - 1) - left(a - 1), h: rowHeight});
      ctx.areaIds.add(key);
    }
  } else {
    const put = (key: string, r: Rect) => { if (ctx.anchors.has(key)) ctx.claimed(key, 'a row column collides with an existing id'); ctx.anchors.set(key, r); ctx.areaIds.add(key); };
    placed.forEach((r, i) => put(`${id}#${i + 1}`, {x: r.x, y: rowTop, w: r.w, h: rowHeight}));
    for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) put(`${id}#${a + 1}-${b + 1}`, {x: must(placed[a]).x, y: rowTop, w: must(placed[b]).x + must(placed[b]).w - must(placed[a]).x, h: rowHeight});
  }
}

/** A step box of a steps() row whose title the badge's indent breaks into a 1-character piece where the title alone wraps into fewer lines
 *  (a title that wraps into whole pieces beside the badge keeps it there, as does a box with an icon). */
function badgeAbove(c: RowBand['children'][number], w: number, ctx: LayoutCtx): boolean {
  const b = c as BoxBand, lines = (x: BoxBand) => layoutBoxContent(x, w - 2 * (b.padX ?? BOX_PAD_X), ctx.widthOf, ctx.roles, ctx.wrap).wrappedRuns[0]?.lines ?? [];
  if (b.step == null || !b.title || b.icon) return false;
  const beside = lines(b);
  return beside.length > 1 && lines({...b, step: undefined}).length < beside.length && beside.some(l => [...l.trim()].length <= 1);
}

export function layoutRow(band: RowBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx, top = snapGrid(ctx.y); // the row sits on the grid; the cursor moves on from where it was
  const rowGap = ctx.gapForLabels(band, cw);
  const {widths, xOffsets} = rowChildGeometry({...band, gap: rowGap}, cw);
  // a steps() row: when one numbered box needs its badge above the title, every badge of the row goes above (the titles stay on one baseline)
  const above = band.children.some((c, i) => (c as {stepRow?: boolean}).stepRow && badgeAbove(c, must(widths[i]), ctx));
  const placedChildren = band.children.map((child, i) => {
    if (!above || !(child as {stepRow?: boolean}).stepRow || (child as BoxBand).icon) return ctx.placeBoxLike(child, padX + must(xOffsets[i]), top, must(widths[i]), true);
    // the badge on a line of its own: the title is laid out without the badge's indent (as a box without a step), then the title and the box move down by the badge's height
    const p = ctx.placeBoxLike({...child, step: undefined}, padX + must(xOffsets[i]), top, must(widths[i]), true), shift = 2 * stepBadgeGeom(ctx.roles).r + TOP_ICON_GAP;
    Object.assign(p, {step: (child as BoxBand).step, stepAbove: true});
    p.h += shift;
    p.wrappedRuns = p.wrappedRuns.map(r => ({...r, lineYs: r.lineYs.map(y => y + shift)}));
    return p;
  });
  const rowHeight = Math.max(...placedChildren.map(c => c.h));
  for (const c of placedChildren) { c.h = rowHeight; if (c.id) ctx.setBox(c.id, c as never, rowHeight); }

  const arrows: RowArrow[] = [];
  if (band.arrows === 'between') {
    for (let i = 0; i < placedChildren.length - 1; i++) {
      const a = must(placedChildren[i]), b = must(placedChildren[i + 1]);
      const y = top + rowHeight / 2;
      arrows.push({x1: a.x + a.w, y1: y, x2: b.x, y2: y});
    }
  }

  registerRowSlots(ctx, band.id, band, top, rowHeight, padX, cw, rowGap, placedChildren);
  ctx.laidOut.push({type: 'row', id: band.id, x: padX, y: top, w: cw, h: rowHeight, children: placedChildren, arrows});
  ctx.y += rowHeight + d.gap;
}
