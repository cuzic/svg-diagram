import type { LayoutCtx } from './layout-ctx.ts';
import type { ScreensBand, WireframeBand } from './types/wireframe.ts';
export declare function placeWireframe(data: WireframeBand, ctx: LayoutCtx, x: number, w: number): void;
export declare function placeScreens(data: ScreensBand, ctx: LayoutCtx, x: number, w: number): void;
export declare function placeScreenGrid(data: ScreensBand, ctx: LayoutCtx, x: number, w: number): void;
export declare function placeStateMatrix(data: ScreensBand, ctx: LayoutCtx, x: number, w: number): void;
