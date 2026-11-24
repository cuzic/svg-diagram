import type {LayoutCtx} from './layout-ctx.ts';
import type {LaidOutScreens, LaidOutWireframe, ScreensBand, WireframeBand} from './types/wireframe.ts';
import {layoutScreens, layoutWireframe} from './wireframe.ts';

function appendScreen(laid: LaidOutWireframe | LaidOutScreens, ctx: LayoutCtx): void {
  for (const {id, x, y, w, h} of laid.anchors) {
    if (id) ctx.register(id, {x, y, w, h}, `a ${laid.type} takes an id that another anchor already has`);
  }
  ctx.laidOut.push(laid);
  ctx.y += laid.h + ctx.d.gap;
}

export function placeWireframe(data: WireframeBand, ctx: LayoutCtx, x: number, w: number): void {
  appendScreen(layoutWireframe(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}

export function placeScreens(data: ScreensBand, ctx: LayoutCtx, x: number, w: number): void {
  appendScreen(layoutScreens(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}
