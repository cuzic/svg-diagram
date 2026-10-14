// Types: pyramid, curve and plane.
import type {LabelRole, Point, Rect, RevealOpts, Theme} from './core.ts';

export interface PyramidLayer {text: string}
export interface PyramidOpts {
  width?: number;
  /** Default 76. */
  layerHeight?: number;
  /** Top width / base width (default 0.3). */
  apexRatio?: number;
}
export interface PyramidBand {
  type: 'pyramid';
  /** Bottom (widest) to top. */
  layers: PyramidLayer[];
  width?: number;
  layerHeight: number;
  apexRatio: number;
}
export type CurveEmphasis = 'accent' | 'danger' | 'muted';
export interface CurvePoint {
  /** 0 = axis bottom, 1 = axis top. */
  y: number;
  emphasis?: CurveEmphasis;
  dropLine?: boolean;
}
export interface CurveOpts {
  /** Default 220. */
  height?: number;
  width?: number;
  yTopLabel?: string;
  yBottomLabel?: string;
  xLabel?: string;
}
export interface CurveBand {
  type: 'curve';
  points: CurvePoint[];
  height: number;
  width?: number;
  yTopLabel?: string;
  yBottomLabel?: string;
  xLabel?: string;
}
export type PlaneTone = 'text' | 'accent' | 'muted' | 'danger';
/** A position in the plane's own units: [x, y]. */
export type PlanePos = [x: number, y: number];
/** A position, or the id of a point of the same plane. */
export type PlaneRef = PlanePos | string;
export interface PlaneAxis {
  /** The axis name, drawn at its end. */
  label?: string;
  /** Default 0. */
  min?: number;
  max: number;
  /** Distance between ticks (default: a round number giving about 6). */
  step?: number;
  /** Explicit ticks instead of `step`: a value, or a value with its own label. */
  ticks?: (number | {at: number; label: string})[];
  /** A categorical axis: the names (lane names, stages) are the ticks, at 1, 2, 3 … (give `max` as the count + 1). Not with `ticks` / `step`. */
  categories?: string[];
}
export interface PlanePoint {
  id?: string;
  at: PlanePos;
  /** Drawn next to the point; the point's tone colours both. */
  label?: string;
  /**
   * Where the label sits. Omitted (or 'auto'): 'right', and when that spot collides with the plane's ink or another label, the first
   * free one of left / above / below / the four diagonals. An explicit side is kept as written.
   */
  labelAt?: 'right' | 'left' | 'above' | 'below' | 'auto';
  /** Moves the label from where labelAt puts it, px [dx, dy]. Given: the label is not moved automatically. */
  labelOffset?: [number, number];
  /**
   * With an automatic `labelAt`: when no side of the point is free, the label moves to the right margin (room is made for it; it is spread
   * apart from the other end labels) and a dotted leader joins it to its point. For a name that must be written even in a crowded plot.
   */
  labelLeader?: boolean;
  tone?: PlaneTone;
  /** dot / ring / cross sit on the 4px grid; disc / hole / square / diamond / triangle sit exactly on the point (a line chart's markers on its vertices). */
  shape?: 'dot' | 'ring' | 'cross' | 'disc' | 'hole' | 'square' | 'diamond' | 'triangle';
  /** The stage it (and its label) appears at; default the plane's own. */
  reveal?: number;
  until?: number;
}
/** A guide line between two positions / points (a projection onto an axis, a path). */
/** `reveal` (here and on PlaneDim / PlaneLabel / PlanePath): default the max of the points it names (a coordinate counts 0) and the plane's own. */
export interface PlaneLine {from: PlaneRef; to: PlaneRef; tone?: PlaneTone; /** Default true. */ dashed?: boolean; arrow?: boolean; reveal?: number}
/**
 * A line through several positions / points. `smooth: true` draws a curve through every point: monotone cubic interpolation
 * (Fritsch-Carlson, like d3's curveMonotoneX) when x only increases along the path — it never overshoots the points, so no
 * hill or valley appears that the data does not have — and centripetal Catmull-Rom (alpha 0.5) otherwise. Without `smooth` it
 * is a polyline. Solid unless `dashed: true`; `arrow` points along the tangent at the last point.
 */
export interface PlanePath {
  through: PlaneRef[];
  smooth?: boolean;
  dashed?: boolean;
  tone?: PlaneTone;
  arrow?: boolean;
  reveal?: number;
  until?: number;
  /**
   * Draw the path as it grows: at a stage the curve (the same one as the full path) runs only as far as the last point that is
   * shown by then. Without it the whole path appears when its last point does.
   */
  grow?: boolean;
  /** Internal (reveal.ts): the stage each piece of a `grow` path appears at. */
  segReveal?: number[];
}
/** A dimension line: the distance between two positions / points, drawn beside them with a label on it. */
export interface PlaneDim {
  from: PlaneRef;
  to: PlaneRef;
  label: string;
  /** Which side of the measured segment the dimension line sits (default: above a horizontal one, right of a vertical one). */
  side?: 'above' | 'below' | 'left' | 'right';
  /** Distance of the dimension line from the measured segment, px (default 26; more to clear the tick labels when it runs along an axis). */
  offset?: number;
  tone?: PlaneTone;
  reveal?: number;
  until?: number;
}
export interface PlaneLabel {at: PlanePos; text: string; anchor?: 'start' | 'middle' | 'end'; tone?: PlaneTone; bold?: boolean; reveal?: number; /** Moves the label from its position, px [dx, dy]. */ offset?: [number, number]}
export interface PlaneOpts extends RevealOpts {
  /** The text role of every label of the figure (axis names, ticks, point / dimension / free labels). Default 'note' (14px). */
  labelRole?: LabelRole;
  /** A spotlight target and a connect() endpoint (the whole figure). */
  id?: string;
  x: PlaneAxis;
  y: PlaneAxis;
  points?: PlanePoint[];
  lines?: PlaneLine[];
  paths?: PlanePath[];
  dims?: PlaneDim[];
  labels?: PlaneLabel[];
  /** Figure height (default 300). */
  height?: number;
  width?: number;
  /** Texts that count in the width of the y axis's tick labels, so that two planes with different ticks can have the same left margin (the X-bar and R charts of xbarR()). */
  yTickSample?: string[];
  /** y grows downward from the top-left origin (image / pixel coordinates). */
  yDown?: boolean;
  /** Light grid lines at the ticks. */
  grid?: boolean;
  /**
   * Direct end labels: the labels of points with an explicit `labelAt: 'right'` stand to the right of the plot (it makes room for the widest) and are
   * spread apart vertically where they would touch. The way a line chart names its series without a legend.
   */
  endLabels?: boolean;
}
export interface PlaneBand extends PlaneOpts {
  type: 'plane';
  height: number;
}
export interface LaidOutPyramidLayer {
  /** Trapezoid corners: bottom-left, bottom-right, top-right, top-left. */
  points: [number, number][];
  opacity: number;
  textColor: string;
  lines: string[];
  textYs: number[];
  cx: number;
}
export interface LaidOutPyramid extends Rect {type: 'pyramid'; day: Theme; layers: LaidOutPyramidLayer[]}
export interface LaidOutCurvePoint {x: number; y: number; emphasis?: CurveEmphasis; dropLine: boolean}
export interface LaidOutCurve extends Rect {
  type: 'curve';
  axisX: number; axisRight: number; axisTop: number; axisBottom: number;
  points: LaidOutCurvePoint[];
  yTopLabel?: string; yBottomLabel?: string; xLabel?: string;
}
/** Text the plane draws: a baseline position, an anchor and a tone. */
export interface PlaneText {s: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; tone: PlaneTone; bold: boolean; reveal?: number}
interface PlaneSeg {x1: number; y1: number; x2: number; y2: number}
export interface LaidOutPlane extends Rect {
  type: 'plane';
  id?: string;
  reveal?: number;
  until?: number;
  /** font-size of every text of the figure (its labelRole at layout time). */
  labelSize: number;
  /** The figure itself (the band is as wide as the page; the figure may be narrower and centred). */
  bounds: Rect;
  axisX: number; axisY: number;
  plotL: number; plotR: number; plotT: number; plotB: number;
  yDown: boolean;
  ticks: PlaneSeg[];
  grid: PlaneSeg[];
  texts: PlaneText[];
  points: {x: number; y: number; tone: PlaneTone; shape: NonNullable<PlanePoint['shape']>; reveal?: number}[];
  lines: (PlaneSeg & {tone: PlaneTone; dashed: boolean; arrow: boolean; reveal?: number})[];
  /** `curves`: one [control 1, control 2, end] per piece of a smooth path (empty for a polyline, which runs through `pts`). `tip`: the unit direction of the arrowhead. `overshoot`: px the curve leaves the plot area. */
  paths?: {pts: {x: number; y: number}[]; curves: {x: number; y: number}[][]; tone: PlaneTone; dashed: boolean; arrow: boolean; tip: {dx: number; dy: number}; reveal?: number; /** `grow` paths: the stage of each piece (one per segment of `pts`). */ segReveal?: number[]; overshoot: number}[];
  dims: {from: Point; to: Point; line: PlaneSeg; ext: PlaneSeg[]; chip: Rect; tone: PlaneTone; reveal?: number}[];
  /** Every label placed, as a rect: verify.ts reports two that overlap, one that leaves the figure, or one on the ink below. `dim`: the dimension line it belongs to. */
  labelBoxes: (Rect & {label: string; dim?: number})[];
  /** The plane's ink a label must stay clear of (axes and their arrowheads, ticks, points, guide and dimension lines). `dim`: the dimension it belongs to (its own label sits on it by design). */
  obstacles: (Rect & {what: string; dim?: number})[];
}
