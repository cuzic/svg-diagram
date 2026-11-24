import {IMAGE_PAD, layoutImage} from './image.ts';
import type {LayoutCtx} from './layout-ctx.ts';
import {snapGrid} from './layout-util.ts';
import {scopeOf} from './anchor-scope.ts';
import {setScope} from './layout-placed.ts';
import type {ImageBand} from './types/image.ts';

export function layoutImageBand(band: ImageBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const top = ctx.y, placed = layoutImage(band, padX, snapGrid(top), cw, widthOf, roles);
  if (band.id) {
    if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'an image takes an id that another anchor already has');
    ctx.anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
  }
  const scope = scopeOf(band);
  setScope(placed, scope);
  for (const a of placed.anchors) ctx.register(a.id, {x: a.x, y: a.y, w: a.w, h: a.h}, 'a mark takes an id that another anchor already has', scope);
  ctx.laidOut.push(placed);
  if (band.children?.length) { // the picture is a backdrop: its parts stack from the top inside it, drawn after it
    const pad = band.pad ?? IMAGE_PAD;
    ctx.y = placed.y + pad;
    ctx.stack(band.children, placed.x + pad, placed.w - 2 * pad);
    const bottom = ctx.y - d.gap, room = placed.y + placed.h - pad;
    if (bottom > room + 0.5) throw new Error(`image(): the parts over it need ${Math.round(bottom - placed.y + pad)}px of height but the picture is ${placed.h}px high (make the picture bigger with width / height, or use less content)`);
  }
  ctx.y = top + placed.h + d.gap;
}
