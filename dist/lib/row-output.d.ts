import type { BandDef } from './band-def.ts';
import type { LaidOutRow, RowBand } from './types/containers.ts';
/**
 * A placed `row` (what areas() and grouprow() lay their cells out as), without the row() builder's own parts: the definition
 * `outputDefinitions` of the bands that place rows points at, so a figure with an areas() has the row's hooks (node ids, rects, drawing).
 */
export declare const rowOutputDefinition: Extract<BandDef<RowBand, LaidOutRow>, {
    internal: true;
}>;
