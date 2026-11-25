import type { Theme, Rect } from './types/core.ts';
import type { Prim } from './types/wireframe-nodes.ts';
import type { LaidOutWireframe, LaidOutScreens } from './types/wireframe.ts';
export type PaintPrim = Exclude<Prim, {
    k: 'text' | 'badge' | 'pill';
}>;
export declare function primRectGeometry(rect: Rect): Rect;
export declare function renderPrims(b: LaidOutWireframe | LaidOutScreens, day: Theme): string;
