import type { WidthOf } from './types/core.ts';
import type { LaidOutBand } from './types/index.ts';
import type { InventoryItem } from './types/inventory.ts';
export interface InventoryContext {
    owner: string;
    widthOf: WidthOf;
}
export declare function whole(band: LaidOutBand, { owner }: InventoryContext): InventoryItem[];
export declare function buildInventoryWith(itemsOf: (band: LaidOutBand, ctx: InventoryContext) => InventoryItem[], laidOut: readonly LaidOutBand[], widthOf: WidthOf): InventoryItem[];
