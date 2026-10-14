// The mutable state a band handler works on while layoutBands() walks the stack top-to-bottom, and the handler type itself.
// Handlers (lib/layout-handlers.ts) take the band, this context and the x / width they are placed at; they push what they lay
// out to `ctx.laidOut`, register anchors, and advance `ctx.y`.

import type {LaidOutConnect, ConnectBand} from './types/containers.ts';
import type {DiagramData, Rect, Roles, WidthOf} from './types/core.ts';
import type {Band, LaidOutBand} from './types/index.ts';
import type {BannerBand, BoxBand, CaptionBand, WrappedRun} from './types/text-bands.ts';

/** A band after placeBoxLike(): its own fields plus geometry, wrapped text and (maybe) the tag pill. */
export type Placed<B> = B & Rect & {wrappedRuns: WrappedRun[]; tagBox?: Rect; inkBox?: Rect};

/** What setBox() reads off a box to make its anchor (a node's anchor is its icon). */
export type AnchorSource = Rect & {type?: string; icon?: string; iconAt?: string; iconSize?: number; padY?: number};

/** What row / grouprow need to know about their children when sharing gaps and column slots. */
export type RowLike = {gap: number; cols?: number; justify?: string; children: (Band & {span?: number; col?: number})[]};

export interface LayoutCtx {
  readonly d: DiagramData;
  readonly roles: Roles;
  readonly widthOf: WidthOf;
  /** The cursor: the y the next band is placed at. */
  y: number;
  readonly laidOut: LaidOutBand[];
  /** id -> {x,y,w,h} */
  readonly anchors: Map<string, Rect>;
  /** a node's anchor is its icon; an arrow leaving its bottom starts under the label */
  readonly nodeBottoms: Map<string, number>;
  /** ids of rows and row columns: anchors that hold other boxes */
  readonly areaIds: Set<string>;
  readonly connects: LaidOutConnect[];
  /** connect()s that came before the boxes they name */
  readonly deferred: ConnectBand[];
  setBox(id: string, c: AnchorSource, h: number): void;
  /** Throws the duplicate-id error. */
  claimed(id: string, what: string): never;
  /** anchors.set(id, rect), after throwing claimed(id, what) when the id is taken. */
  register(id: string, rect: Rect, what: string): void;
  placeBoxLike<B extends CaptionBand | BoxBand | BannerBand>(band: B, x: number, y: number, w: number, isBoxLike: boolean): Placed<B>;
  /** Lays `bands` out one after the other at x / width, from the cursor on. */
  stack(bands: Band[], x: number, w: number): void;
  /** The gap a row's children are laid out with (grown to fit labelled connectors between them). */
  gapForLabels(band: RowLike, cw: number): number;
}

export type BandLayoutHandler<B> = (band: B, ctx: LayoutCtx, x: number, w: number) => void;

/** One handler per band type, each checked against its own band type. */
export type BandLayoutHandlers = {[T in Band['type']]?: BandLayoutHandler<Extract<Band, {type: T}>>};
