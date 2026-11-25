import type { BandLayoutHandler, LayoutCtx } from './layout-ctx.ts';
import type { Rect } from './types/core.ts';
import type { Band, LaidOutBand } from './types/index.ts';
export declare const rectOf: (p: Rect) => Rect;
/** Writes `scope` onto a laid-out band/step whose static type has no such field (ADR 0012: scope is bolted on after layout, not part of each band's own shape). */
export declare const setScope: (placed: object, scope: string | undefined) => void;
/**
 * A band laid out by one call (`layout`) that returns its own placement: its id (and its marks' ids, when `anchorWhat` is given)
 * become anchors, it is pushed, and the cursor moves past it. `what` / `anchorWhat` finish the duplicate-id message.
 */
type Describe<B> = string | ((band: B) => string);
export declare function placedBand<B extends Band & {
    id?: string;
}, P extends LaidOutBand & Rect>(layout: (band: B, x: number, y: number, w: number, ctx: LayoutCtx) => P, what: Describe<B>, anchorWhat?: Describe<B>): BandLayoutHandler<B>;
export declare function appendPlacedBand(band: Band & {
    id?: string;
}, placed: LaidOutBand & Rect, ctx: LayoutCtx, what: string, anchorWhat?: string): void;
export {};
