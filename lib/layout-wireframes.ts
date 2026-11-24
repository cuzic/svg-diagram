import {appendScreen} from './wireframe-placement.ts';
import type {LayoutCtx} from './layout-ctx.ts';
import type {ScreensBand, WireframeBand} from './types/wireframe.ts';
import {layoutScreenGrid, layoutScreens, layoutStateMatrix, layoutWireframe} from './wireframe.ts';

export function placeWireframe(data: WireframeBand, ctx: LayoutCtx, x: number, w: number): void {
  appendScreen(layoutWireframe(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}

export function placeScreens(data: ScreensBand, ctx: LayoutCtx, x: number, w: number): void {
  appendScreen(layoutScreens(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}

export function placeScreenGrid(data: ScreensBand, ctx: LayoutCtx, x: number, w: number): void {
  appendScreen(layoutScreenGrid(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}

export function placeStateMatrix(data: ScreensBand, ctx: LayoutCtx, x: number, w: number): void {
  appendScreen(layoutStateMatrix(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}
