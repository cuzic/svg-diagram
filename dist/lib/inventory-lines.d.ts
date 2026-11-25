import type { LaidOutConnect } from './types/containers.ts';
import type { Arrow, Point } from './types/core.ts';
import type { InventoryItem } from './types/inventory.ts';
export declare function pathItems(points: Point[], arrow: Arrow | undefined, owner: string): InventoryItem[];
export declare function connectorInventory(connects: readonly LaidOutConnect[], labelSize?: number): InventoryItem[];
