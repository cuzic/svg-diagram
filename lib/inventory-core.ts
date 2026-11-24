import type {WidthOf} from './types/core.ts';
import type {LaidOutBand} from './types/index.ts';
import type {InventoryItem} from './types/inventory.ts';

export interface InventoryContext {owner: string; widthOf: WidthOf}

export function whole(band: LaidOutBand, {owner}: InventoryContext): InventoryItem[] {
  if (!('h' in band)) return [];
  const {type, x, y, w, h} = band;
  if (![x, y, w, h].every(Number.isFinite)) return [];
  return [{kind: 'whole', owner, band: type, rect: {x, y, w, h}}];
}

export function buildInventoryWith(
  itemsOf: (band: LaidOutBand, ctx: InventoryContext) => InventoryItem[],
  laidOut: readonly LaidOutBand[], widthOf: WidthOf,
): InventoryItem[] {
  return laidOut.flatMap((band, i) => {
    const owner = ('id' in band ? band.id : undefined) ?? `${band.type}[${i}]`;
    return itemsOf(band, {owner, widthOf});
  });
}
