import type { LayoutCtx, RowLike } from './layout-ctx.ts';
import type { RowBand } from './types/containers.ts';
import type { Rect } from './types/core.ts';
export declare function registerRowSlots(ctx: Pick<LayoutCtx, 'anchors' | 'areaIds' | 'claimed'>, id: string | undefined, band: RowLike, rowTop: number, rowHeight: number, padX: number, cw: number, gap: number, placed: Rect[]): void;
export declare function layoutRow(band: RowBand, ctx: LayoutCtx, padX: number, cw: number): void;
