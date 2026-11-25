import type { FontFamily, Roles } from './types/core.ts';
import type { VennSet, VennOpts, VennBand, LaidOutFlowShape } from './flow-types.ts';
import type { AnchorFn, Texts } from './flow-layout-core.ts';
export declare function vennBand(sets: readonly VennSet[], opts?: VennOpts): VennBand;
/** `rings` may be a count (1-6) of plain rings when the rings are cut into `sectors` (a bullseye whose rings have no names). */
export declare function vennTexts(b: VennBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutVenn(b: VennBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void;
