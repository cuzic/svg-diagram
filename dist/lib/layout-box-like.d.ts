import type { LayoutCtx, Placed } from './layout-ctx.ts';
import type { Roles, WidthOf, WrapMode } from './types/core.ts';
import type { BannerBand, BoxBand, CaptionBand } from './types/text-bands.ts';
export declare function layoutBoxLike<B extends CaptionBand | BoxBand | BannerBand>(band: B, x: number, y0: number, w: number, isBoxLike: boolean, widthOf: WidthOf, roles: Roles, wrap: WrapMode): Placed<B>;
/** caption / box / banner (and, as before, anything a handler does not claim). */
export declare function layoutBoxLikeBand(band: CaptionBand | BoxBand | BannerBand, ctx: LayoutCtx, padX: number, cw: number): void;
