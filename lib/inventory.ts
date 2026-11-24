import {connectorInventory} from './inventory-lines.ts';
import type {LaidOutOf, LaidOutType} from './band-table.ts';
import {boxItems, captionItems, childBoxes, groupItems, rowItems} from './inventory-boxes.ts';
import {buildInventoryWith, whole} from './inventory-core.ts';
import type {InventoryContext} from './inventory-core.ts';
import type {LaidOutConnect} from './types/containers.ts';
import type {WidthOf} from './types/core.ts';
import type {LaidOutBand} from './types/index.ts';
import type {InventoryItem} from './types/inventory.ts';

export {INK_ASCENT, INK_HEIGHT} from './inventory-boxes.ts';

type InventoryHandlers = {[T in LaidOutType]: (band: LaidOutOf<T>, ctx: InventoryContext) => InventoryItem[]};

export const INVENTORY_HANDLERS = {
  caption: captionItems,
  box: boxItems,
  banner: boxItems,
  group: groupItems,
  row: rowItems,
  grid: childBoxes, // Grids have no height of their own; only their children contribute items.
  status: whole,
  legend: whole,
  swimlane: whole,
  wireframe: whole,
  screens: whole,
  sequence: whole,
  table: whole,
  raw: whole, // raw() supplies its own height; whole skips it if the height is non-finite.
  pyramid: whole,
  curve: whole,
  plane: whole,
  quadrant: whole,
  wordart: whole,
  chevron: whole,
  funnel: whole,
  cycle: whole,
  venn: whole,
  concentric: whole,
  emblem: whole,
  valueChain: whole,
  bars: whole,
  chart: whole,
  image: whole,
  people: whole,
  dots: whole,
  math: whole,
  timeline: whole,
  tree: whole,
  states: whole,
  cause: whole,
  cloud: whole,
  gantt: whole,
  classes: whole,
  bpmn: whole,
  fta: whole,
  comic: whole,
  bowtie: whole,
} satisfies InventoryHandlers;

export function buildInventory(laidOut: LaidOutBand[], connects: LaidOutConnect[], widthOf: WidthOf, labelSize?: number) {
  const items = buildInventoryWith((band, ctx) => {
    const handler = INVENTORY_HANDLERS[band.type] as (band: LaidOutBand, ctx: InventoryContext) => InventoryItem[];
    return handler(band, ctx);
  }, laidOut, widthOf);
  return {items: items.concat(connectorInventory(connects, labelSize))};
}
