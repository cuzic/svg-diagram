import type { FontFamily, Roles } from './types/core.ts';
import type { EmblemItem, EmblemOpts, EmblemBand, LaidOutFlowShape } from './flow-types.ts';
import type { AnchorFn, Texts } from './flow-layout-core.ts';
export declare function emblemBand(items: readonly EmblemItem[], opts?: EmblemOpts): EmblemBand;
/** Porter's value chain (価値連鎖): support activities as bars over the primary activities as chevrons, and the margin as an arrow at the right. */
export declare function emblemTexts(b: EmblemBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutEmblem(b: EmblemBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void;
