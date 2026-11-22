import type {Point, Rect} from './core.ts';

export type InventoryItem =
  /** Wrapped lines use ink rectangles; connector labels keep the layout's labelBox (or chipBox), with baseline at labelY. */
  | {kind: 'text'; owner: string; rect: Rect; size: number}
  /** A box's fill and border, as a clockwise polygon. */
  | {kind: 'frame'; owner: string; poly: Point[]}
  | {kind: 'badge'; owner: string; rect: Rect; what: 'tag' | 'stamp'}
  | {kind: 'connector'; owner: string; points: Point[]}
  | {kind: 'arrowhead'; owner: string; rect: Rect}
  /** Until a band type has a detailed inventory, its whole rectangle counts as content. */
  | {kind: 'whole'; owner: string; rect: Rect; band: string};

export interface ContentInventory {items: InventoryItem[]}
