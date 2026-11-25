import type { LayoutCtx } from './layout-ctx.ts';
import type { CauseBand } from './types/diagrams.ts';
/** ADR 0070 D7: scale an independent cause tree's lines with canvas text, unless the whole-figure retry drops the scale. */
export declare function placeCause(band: CauseBand, ctx: LayoutCtx, x: number, width: number): void;
