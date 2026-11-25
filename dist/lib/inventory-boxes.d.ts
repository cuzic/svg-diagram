import type { InventoryContext } from './inventory-core.ts';
import type { LaidOutGroup, LaidOutRow } from './types/containers.ts';
import type { InventoryItem } from './types/inventory.ts';
import type { LaidOutBanner, LaidOutBox, LaidOutCaption } from './types/text-bands.ts';
export declare const INK_ASCENT = 1;
export declare const INK_HEIGHT = 1.3;
export declare const captionItems: (band: LaidOutCaption, ctx: InventoryContext) => InventoryItem[];
export declare const groupItems: (band: LaidOutGroup, { owner }: InventoryContext) => InventoryItem[];
export declare function boxItems(band: LaidOutBox | LaidOutBanner, ctx: InventoryContext): InventoryItem[];
export declare function childBoxes({ children }: {
    children: LaidOutBox[];
}, { owner, widthOf }: InventoryContext): InventoryItem[];
export declare function rowItems(band: LaidOutRow, ctx: InventoryContext): InventoryItem[];
