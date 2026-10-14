// Types: group / legend / spacer / raw, row / grid / connect.
import type {Align, Arrow, ArrowWeight, Bend, Dimmed, EmphasisTone, LineStyle, PlainColorKey, Point, Rect, RevealOpts, Route, TextTone, Theme} from './core.ts';
import type {Band} from './index.ts';
import type {BoxBand, BoxTone, LaidOutBox, RichSpans, RichText} from './text-bands.ts';

export interface GroupOpts extends RevealOpts {
  title?: RichText;
  titleTone?: TextTone;
  titleAlign?: Align;
  /** Default 'muted'. */
  tone?: BoxTone;
  /** Default true for tone 'plain'. */
  dashed?: boolean;
  /** Inner padding (default 16; 0 with `frame: false`). */
  pad?: number;
  /** Chip at the bottom-right corner inside the frame (see box({stamp})). */
  stamp?: string;
  /**
   * Where the content sits when a row() stretches the frame taller than it (ADR 0014): 'center' (default) puts the content
   * below the title in the middle of the room (the gaps between its parts grow by up to 16px first); 'top' keeps it at the top;
   * 'stretch' makes a single box fill the room. Under 16px of room nothing moves. No effect outside a row, or with `frame: false`.
   */
  valign?: 'top' | 'center' | 'stretch';
  /** false draws no frame (and takes no title): a plain container, so a table / plane / banner can sit in a row() without a doubled outline. */
  frame?: false;
  id?: string;
  /** Sizing when the group is a child of row(): the same fields as a box (flex / width for justify, span / col for cols). */
  flex?: number;
  width?: number;
  span?: number;
  col?: number;
}
export interface GroupBand {
  type: 'group';
  children: Band[];
  title?: string;
  /** Internal: see BoxBand. */
  spans?: RichSpans;
  titleTone?: TextTone;
  titleAlign?: Align;
  tone: BoxTone;
  dashed?: boolean;
  pad?: number;
  frame?: false;
  stamp?: string;
  /** See GroupOpts. */
  valign?: 'top' | 'center' | 'stretch';
  id?: string;
  flex?: number;
  width?: number;
  span?: number;
  col?: number;
  reveal?: number;
  until?: number;
}
/** A row() whose children include groups: they sit side by side and their frames are stretched to the tallest one. */
export interface GroupRowBand {
  type: 'grouprow';
  id?: string;
  cols?: number;
  children: (BoxBand | GroupBand)[];
  gap: number;
  justify: RowJustify;
  itemWidth?: number;
  reveal?: number;
  until?: number;
}
/** A legend entry: a line sample ({line, arrow?}) or a tone swatch ({tone, dashed?}). */
export interface LegendItem {
  label: string;
  line?: LineStyle;
  arrow?: Arrow;
  /** A thick line sample; needs `line` (legend() fills in 'solid'). */
  weight?: ArrowWeight;
  tone?: EmphasisTone;
  dashed?: boolean;
}
export interface LegendOpts {align?: 'left' | 'center'}
export interface LegendBand {
  type: 'legend';
  items: LegendItem[];
  align: 'left' | 'center';
}
export interface SpacerBand {type: 'spacer'; h: number}
/** What draw(ctx) of raw() receives. */
export interface RawContext extends Rect {
  day: Theme;
  /** Token colour: 'accent' | 'accent-soft' | a PlainColorKey (anything else falls back to 'text'). */
  color(tone: RawColorTone): string;
}
export type RawColorTone = 'accent' | 'accent-soft' | PlainColorKey;
export interface RawOpts {
  /** Height reserved for the fragment (default 0). */
  h?: number;
  /** Returns a raw SVG fragment string. */
  draw: (ctx: RawContext) => string;
}
export interface RawBand {
  type: 'raw';
  h: number;
  draw: (ctx: RawContext) => string;
  /** Read by layout.ts as an anchor id, but raw() does not currently forward one, so it is always undefined. */
  id?: string;
}
export type RowArrows = 'between' | 'none';
export type RowJustify = 'stretch' | 'center' | 'start';
export interface RowOpts {
  /** N: shared N-column grid (children take `span` columns, and `col` follows the previous child's span).
   *  [6, 6]: the same grid declared as one span per child (N = their sum; no `span` / `col` on the children). */
  cols?: number | number[];
  gap?: number;
  arrows?: RowArrows;
  justify?: RowJustify;
  /** Fixed width per child for justify 'center' | 'start' (default 160). */
  width?: number;
  /** Makes the row an anchor, and its columns ones: `r.col(5).top` (see RowHandle). */
  id?: string;
}
export interface RowBand {
  type: 'row';
  id?: string;
  cols?: number;
  children: BoxBand[];
  gap: number;
  arrows: RowArrows;
  justify: RowJustify;
  itemWidth?: number;
}
export interface GridOpts {
  cols: number;
  gap?: number;
}
/** What makes a grid a canvas() (lib/canvas.ts): where each child sits, and how the template's columns and rows share the space. */
export interface CanvasLayout {
  template: string;
  /** One per child: the column / row it starts in and the columns / rows it spans. */
  place: {col: number; row: number; cs: number; rs: number}[];
  colW: number[];
  rowW: number[];
  /** Least height / width of the canvas. */
  aspect: number;
  /** The least height (px) the user asked for: more content than fits throws. */
  h?: number;
  title?: string;
  /** One per child: its tone (if any) is said in words by its pill, so it needs no legend entry. */
  worded: boolean[];
  /** Regions without content, and whether the author wanted every one filled (rule canvas-region-empty). */
  empty: string[];
  requireAll: boolean;
}
export interface GridBand {
  type: 'grid';
  children: BoxBand[];
  cols: number;
  gap: number;
  canvas?: CanvasLayout;
}
export interface ConnectOpts extends RevealOpts {
  route?: Route;
  /** loop-under: how far below the lower anchor the return path runs (default 32). */
  dip?: number;
  bend?: Bend;
  /** Distance of an elbow's middle leg from the endpoint for bend 'start' | 'end'. */
  bendOffset?: number;
  arrow?: Arrow;
  line?: LineStyle;
  weight?: ArrowWeight;
  /** Label in a bordered pill sitting ON the line. */
  chip?: boolean;
  /** 0..1 along a straight/loop-under connector where the label sits. */
  labelAt?: number;
  tone?: TextTone;
  label?: string;
  /** Legacy: `marker: false` = arrow 'none'. */
  marker?: boolean;
  /** Legacy: `dashed: true` = line 'dashed'. */
  dashed?: boolean;
}
export interface ConnectBand {
  type: 'connect';
  /** 'id', 'id:side' or 'id:side@t'. */
  from: string;
  to: string;
  route: Route;
  dip: number;
  bend: Bend;
  bendOffset?: number;
  arrow: Arrow;
  line: LineStyle;
  weight?: ArrowWeight;
  chip: boolean;
  labelAt: number;
  tone?: TextTone;
  label?: string;
  /** bracket() / callout(): an annotation connector (the path is a bracket under / over a span, or a leader line to a bubble). */
  annot?: {kind: 'bracket' | 'callout'; side: 'below' | 'above' | 'left' | 'right'};
  reveal?: number;
  until?: number;
  /** Internal (versus()): the end on a top / bottom side takes the start's x (kept inside that side), so the line drops plumb. */
  plumb?: boolean;
}
/** branch() target: connect() options plus the target ref. */
export interface BranchTarget extends ConnectOpts {to: string}
/** The frame of a group; its children are laid out as separate bands after it. */
export interface LaidOutGroup extends Rect, Dimmed {type: 'group'; tone: BoxTone; dashed?: boolean; frame?: false; stamp?: string; stampW?: number; id?: string; reveal?: number}
export interface LaidOutLegendItem extends LegendItem {textW: number; w: number; x: number; y: number}
export interface LaidOutLegend extends Rect {type: 'legend'; items: LaidOutLegendItem[]}
export interface RowArrow {x1: number; y1: number; x2: number; y2: number}
export interface LaidOutRow extends Rect, Dimmed {type: 'row'; id?: string; children: LaidOutBox[]; arrows: RowArrow[]}
/** Grids have no `h` of their own (children carry the geometry). */
export interface LaidOutGrid extends Dimmed {type: 'grid'; x: number; y: number; w: number; children: LaidOutBox[]}
export interface LaidOutRaw extends RawBand, Rect {}
/** A connect() once its endpoints are known. `from` / `to` are resolved points; the original refs live in fromLabel / toLabel. */
export interface LaidOutConnect extends Omit<ConnectBand, 'from' | 'to'> {
  dim?: boolean;
  from: Point;
  to: Point;
  fromId: string;
  toId: string;
  /** Set when an end is a row or a column of a row (row({id})): the boxes in this area (even partly) count as that end. */
  fromArea?: Rect;
  toArea?: Rect;
  /** The original 'id:side@t' strings (for error messages). */
  fromLabel: string;
  toLabel: string;
  /** The polyline the connector follows (>= 2 points). */
  points: Point[];
  /** Thin rects covering the path's ink, for overlap checks. */
  pathSegments: Rect[];
  labelX?: number;
  labelY?: number;
  labelBox?: Rect;
  chipBox?: Rect;
}
