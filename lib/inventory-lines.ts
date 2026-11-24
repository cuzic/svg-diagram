import {must} from './must.ts';
import {CONNECT_LABEL_SIZE} from './tokens.ts';
import type {LaidOutConnect} from './types/containers.ts';
import type {Arrow, Point, Rect} from './types/core.ts';
import type {InventoryItem} from './types/inventory.ts';

const HEAD_LENGTH = 12;
const HEAD_PAD = 4;

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

export function pathItems(points: Point[], arrow: Arrow | undefined, owner: string): InventoryItem[] {
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

export function connectorInventory(connects: readonly LaidOutConnect[], labelSize = CONNECT_LABEL_SIZE): InventoryItem[] {
  const items: InventoryItem[] = [];
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
  return items;
}
