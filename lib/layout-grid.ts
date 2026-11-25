import {splitAtoms, textWidth} from './atoms.ts';
import {CANVAS_MIN_ROW_H, canvasColumns, canvasRowHeights, canvasSpan, trackRowYs} from './canvas.ts';
import type {LayoutCtx, Placed} from './layout-ctx.ts';
import {BOX_PAD_X, CANVAS_MIN_REGION_W, TAG_H, gridChildGeometry, snapGrid} from './layout-util.ts';
import {must} from './must.ts';
import type {GridBand} from './types/containers.ts';
import type {BoxBand, CaptionBand} from './types/text-bands.ts';

function layoutCanvasGrid(band: GridBand & {canvas: NonNullable<GridBand['canvas']>}, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, widthOf} = ctx;
  const cv = band.canvas, gap = band.gap, top0 = ctx.y;
  // a region's pill sits on its top edge, half above it: the rows under the first keep it clear of the box above
  // (and of the caption above the first row)
  const tagged = (row: (r: number) => boolean): boolean => band.children.some((c, i) => c.tag && row(must(cv.place[i]).row));
  const rowGap = tagged(r => r > 0) ? Math.max(gap, TAG_H / 2 + 4) : gap;
  if (cv.title) {
    const t = ctx.placeBoxLike({type: 'caption', text: cv.title, align: 'left', role: 'title', bold: true, tone: 'text', mono: false} as CaptionBand, padX, ctx.y, cw, false);
    ctx.laidOut.push(t);
    ctx.y += t.h + Math.max(d.gap / 2, tagged(r => r === 0) ? TAG_H / 2 + 4 : 0);
  }
  // every edge on the 4px grid the emitter snaps shapes to, so neighbouring regions keep one straight edge and even gutters
  const top = Math.ceil(ctx.y / 4 - 1e-6) * 4, cols = canvasColumns(cv, padX, cw, gap);
  const placed = band.children.map((child, i) => {
    const s = canvasSpan(cols, must(cv.place[i]));
    const name = child.title ?? `region ${i + 1}`;
    if (s.w < CANVAS_MIN_REGION_W) throw new Error(`canvas("${cv.template}"): region "${name}" is only ${Math.max(0, Math.round(s.w))}px wide (at least ${CANVAS_MIN_REGION_W}px): widen the figure (diagram({width})) or use a smaller gap`);
    const p = ctx.placeBoxLike(child, s.x, top, s.w, true);
    // a word longer than the region is placed whole by the wrapper (it has no place to break) and would run out of the box
    const room = s.w - 2 * (child.padX ?? BOX_PAD_X) + 0.5;
    for (const r of p.wrappedRuns) for (const line of r.lines) for (const atom of splitAtoms(line)) {
      if (textWidth(widthOf, atom, r.size, r.weight, r.mono ? 'mono' : 'sans') + (r.indent ?? 0) > room) throw new Error(`canvas("${cv.template}"): "${atom.slice(0, 40)}" in region "${name}" is wider than the region (${Math.round(room)}px of text): break the word (a space or a shorter word), or widen the figure`);
    }
    return p;
  });
  // fit 'content' (default): a row is as tall as its regions need, a region meant to be filled at least CANVAS_MIN_ROW_H; only h adds room.
  // fit 'aspect': the template's height / width is a floor, except on a slide canvas, where it never grows past the slide's height for that alone
  const aspectH = cv.aspect * cw, slideRoom = d.canvas ? d.canvas.height - d.pad - top - 4 * cv.rowW.length /* the 4px grid */ : Infinity;
  const needs = placed.map((p, i) => cv.fit === 'aspect' || cv.h !== undefined || !cv.floor[i] ? p.h : Math.max(p.h, CANVAS_MIN_ROW_H));
  const rows = canvasRowHeights(cv, needs, rowGap, cv.h ?? (cv.fit === 'aspect' ? Math.max(0, Math.min(aspectH, slideRoom)) : 0));
  const total = rows.reduce((a, b) => a + b, 0) + rowGap * (rows.length - 1);
  if (cv.h !== undefined && total > cv.h + 0.5) throw new Error(`canvas("${cv.template}"): the regions need ${Math.ceil(total)}px of height but h is ${cv.h}px (shorten the text, widen the figure, or leave h out)`);
  const rowY = trackRowYs(top, rows, rowGap);
  placed.forEach((p, i) => {
    const pl = must(cv.place[i]), h = must(rowY[pl.row + pl.rs]) - rowGap - must(rowY[pl.row]);
    p.y = must(rowY[pl.row]); p.h = h;
    if (p.tagBox) p.tagBox.y = p.y - p.tagBox.h / 2;
    if (p.id) ctx.setBox(p.id, p as never, h);
  });
  ctx.laidOut.push({type: 'grid', x: padX, y: top0, w: cw, children: placed});
  ctx.y = must(rowY[rows.length]) - rowGap + d.gap;
}

function layoutPlainGrid(band: GridBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx;
  const gridStartY = snapGrid(ctx.y);
  const {xs, ws} = gridChildGeometry(band, cw);
  const cols = band.cols;
  const placedRows: Placed<BoxBand>[] = [];
  for (let i = 0; i < band.children.length; i += cols) {
    const rowChildren = band.children.slice(i, i + cols);
    const placed = rowChildren.map((child, j) =>
      ctx.placeBoxLike(child, padX + must(xs[j]), ctx.y, must(ws[j]), true));
    const rowHeight = Math.max(...placed.map(c => c.h));
    for (const c of placed) { c.h = rowHeight; if (c.id) ctx.setBox(c.id, c as never, rowHeight); }
    placedRows.push(...placed);
    ctx.y += rowHeight + band.gap; // this row's gap; replaced by d.gap below after the loop
  }
  ctx.laidOut.push({type: 'grid', x: padX, y: gridStartY, w: cw, children: placedRows});
  ctx.y += d.gap - band.gap; // swap the last grid-row's internal gap for the between-bands gap
}

export function layoutGridBand(band: GridBand, ctx: LayoutCtx, padX: number, cw: number): void {
  if (band.canvas) layoutCanvasGrid(band as GridBand & {canvas: NonNullable<GridBand['canvas']>}, ctx, padX, cw);
  else layoutPlainGrid(band, ctx, padX, cw);
}
