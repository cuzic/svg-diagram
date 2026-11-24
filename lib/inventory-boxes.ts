import {boxTextPlacement, captionTextPlacement, frameGeometry, stampGeometry, tagGeometry} from './emit-boxes.ts';
import {runLineOrigin} from './emit-common.ts';
import {pathItems} from './inventory-lines.ts';
import type {InventoryContext} from './inventory-core.ts';
import {lineWidth} from './layout-text.ts';
import {must} from './must.ts';
import type {LaidOutGroup, LaidOutRow} from './types/containers.ts';
import type {Align} from './types/core.ts';
import type {InventoryItem} from './types/inventory.ts';
import type {LaidOutBanner, LaidOutBox, LaidOutCaption, WrappedRun} from './types/text-bands.ts';

export const INK_ASCENT = 1.0;
export const INK_HEIGHT = 1.3;
const INK_SIDE_PAD = 0.125;

export const captionItems = (band: LaidOutCaption, ctx: InventoryContext) =>
  wrappedText(band.wrappedRuns, captionTextPlacement(band), ctx);
export const groupItems = (band: LaidOutGroup, {owner}: InventoryContext) => boxChrome(band, owner);

function wrappedText(
  runs: WrappedRun[],
  placement: {originX: number; originY: number; w: number; align: Align},
  {owner, widthOf}: InventoryContext,
): InventoryItem[] {
  return runs.flatMap(run => {
    const {lx, anchor} = runLineOrigin(run, placement), {size} = run;
    return run.lines.map((_, i) => {
      const w = lineWidth(widthOf, run, i);
      const x = anchor === 'middle' ? lx - w / 2 : anchor === 'end' ? lx - w : lx;
      const y = placement.originY + must(run.lineYs[i]) - INK_ASCENT * size;
      const pad = INK_SIDE_PAD * size;
      return {kind: 'text', owner, rect: {x: x - pad, y, w: w + 2 * pad, h: INK_HEIGHT * size}, size};
    });
  });
}

function boxChrome(band: LaidOutBox | LaidOutBanner | LaidOutGroup, owner: string): InventoryItem[] {
  const items: InventoryItem[] = [];
  if (band.type === 'banner' || band.frame !== false) {
    const {x, y, w, h} = frameGeometry(band);
    items.push({kind: 'frame', owner, poly: [{x, y}, {x: x + w, y}, {x: x + w, y: y + h}, {x, y: y + h}]});
  }
  if (band.type === 'box' && band.tagBox) items.push({kind: 'badge', owner, what: 'tag', rect: tagGeometry(band.tagBox)});
  if (band.stampW !== undefined) items.push({kind: 'badge', owner, what: 'stamp', rect: stampGeometry(band, band.stampW)});
  return items;
}

export function boxItems(band: LaidOutBox | LaidOutBanner, ctx: InventoryContext): InventoryItem[] {
  return [...boxChrome(band, ctx.owner), ...wrappedText(band.wrappedRuns, boxTextPlacement(band), ctx)];
}

export function childBoxes({children}: {children: LaidOutBox[]}, {owner, widthOf}: InventoryContext): InventoryItem[] {
  return children.flatMap((child, i) => boxItems(child, {owner: child.id ?? `${owner}/${i}`, widthOf}));
}

export function rowItems(band: LaidOutRow, ctx: InventoryContext): InventoryItem[] {
  return [
    ...childBoxes(band, ctx),
    ...band.arrows.flatMap(({x1, y1, x2, y2}, i) =>
      pathItems([{x: x1, y: y1}, {x: x2, y: y2}], 'end', `${ctx.owner}>${i}`)),
  ];
}

