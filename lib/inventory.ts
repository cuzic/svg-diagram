import type {LaidOutOf, LaidOutType} from './band-table.ts';
import {boxTextPlacement, captionTextPlacement, frameGeometry, stampGeometry, tagGeometry} from './emit-boxes.ts';
import {runLineOrigin} from './emit-common.ts';
import {lineWidth} from './layout-text.ts';
import {must} from './must.ts';
import {CONNECT_LABEL_SIZE} from './tokens.ts';
import type {LaidOutConnect, LaidOutGroup, LaidOutRow} from './types/containers.ts';
import type {Align, Arrow, Point, Rect, WidthOf} from './types/core.ts';
import type {LaidOutBand} from './types/index.ts';
import type {ContentInventory, InventoryItem} from './types/inventory.ts';
import type {LaidOutBanner, LaidOutBox, WrappedRun} from './types/text-bands.ts';

export const INK_ASCENT = 1.0;
export const INK_HEIGHT = 1.3;
const INK_SIDE_PAD = 0.125;
const HEAD_LENGTH = 12;
const HEAD_PAD = 4;

interface InventoryContext {owner: string; widthOf: WidthOf}
type InventoryHandlers = {[T in LaidOutType]: (band: LaidOutOf<T>, ctx: InventoryContext) => InventoryItem[]};

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

function boxItems(band: LaidOutBox | LaidOutBanner, ctx: InventoryContext): InventoryItem[] {
  return [...boxChrome(band, ctx.owner), ...wrappedText(band.wrappedRuns, boxTextPlacement(band), ctx)];
}

function childBoxes({children}: {children: LaidOutBox[]}, {owner, widthOf}: InventoryContext): InventoryItem[] {
  return children.flatMap((child, i) => boxItems(child, {owner: child.id ?? `${owner}/${i}`, widthOf}));
}

function rowItems(band: LaidOutRow, ctx: InventoryContext): InventoryItem[] {
  return [
    ...childBoxes(band, ctx),
    ...band.arrows.flatMap(({x1, y1, x2, y2}, i) =>
      pathItems([{x: x1, y: y1}, {x: x2, y: y2}], 'end', `${ctx.owner}>${i}`)),
  ];
}

function whole({type, x, y, w, h}: Rect & {type: LaidOutType}, {owner}: InventoryContext): InventoryItem[] {
  if (![x, y, w, h].every(Number.isFinite)) return [];
  return [{kind: 'whole', owner, band: type, rect: {x, y, w, h}}];
}

export const INVENTORY_HANDLERS = {
  caption: (band, ctx) => wrappedText(band.wrappedRuns, captionTextPlacement(band), ctx),
  box: boxItems,
  banner: boxItems,
  group: (band, {owner}) => boxChrome(band, owner),
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

/** Bounds of the first HEAD_LENGTH pixels along the path, starting at the marked end. */
function headRect(points: Point[], start: boolean): Rect {
  let i = start ? 0 : points.length - 1;
  const step = start ? 1 : -1;
  let p = must(points[i]);
  let left = p.x, right = p.x, top = p.y, bottom = p.y;
  let remaining = HEAD_LENGTH;
  for (i += step; i >= 0 && i < points.length && remaining > 0; i += step) {
    const q = must(points[i]), dx = q.x - p.x, dy = q.y - p.y;
    const length = Math.hypot(dx, dy);
    const fraction = length <= remaining ? 1 : remaining / length;
    const x = p.x + fraction * dx, y = p.y + fraction * dy;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    remaining -= length;
    p = q;
  }
  return {x: left - HEAD_PAD, y: top - HEAD_PAD, w: right - left + 2 * HEAD_PAD, h: bottom - top + 2 * HEAD_PAD};
}

function pathItems(points: Point[], arrow: Arrow | undefined, owner: string): InventoryItem[] {
  const items: InventoryItem[] = [{kind: 'connector', owner, points}];
  if (arrow === 'start' || arrow === 'both') items.push({kind: 'arrowhead', owner, rect: headRect(points, true)});
  if (arrow === 'end' || arrow === 'both') items.push({kind: 'arrowhead', owner, rect: headRect(points, false)});
  return items;
}

function connectItems(c: LaidOutConnect, owner: string, labelSize: number): InventoryItem[] {
  const items = pathItems(c.points.map(p => ({...p})), c.arrow, owner);
  const rect = c.chipBox ?? c.labelBox;
  if (rect) items.push({kind: 'text', owner, rect: {...rect}, size: labelSize});
  return items;
}

export function buildInventory(
  laidOut: LaidOutBand[], connects: LaidOutConnect[], widthOf: WidthOf, labelSize = CONNECT_LABEL_SIZE,
): ContentInventory {
  const items = laidOut.flatMap((band, i) => {
    const owner = ('id' in band ? band.id : undefined) ?? `${band.type}[${i}]`;
    const handler = INVENTORY_HANDLERS[band.type] as (band: LaidOutBand, ctx: InventoryContext) => InventoryItem[];
    return handler(band, {owner, widthOf});
  });
  const ids = connects.map(c => `${c.fromId}>${c.toId}`);
  // Reserve the original IDs so a generated suffix cannot collide with one.
  const nextIndex = new Map(ids.map(id => [id, 0]));
  connects.forEach((c, i) => {
    const id = must(ids[i]);
    let index = must(nextIndex.get(id)), owner = id;
    if (index > 0) {
      do { owner = `${id}[${index++}]`; } while (nextIndex.has(owner));
    }
    nextIndex.set(id, Math.max(1, index));
    items.push(...connectItems(c, owner, labelSize));
  });
  return {items};
}
