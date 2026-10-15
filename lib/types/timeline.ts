// Types: timeline and gantt.
import type {Anchor, Dimmed, Rect, RevealOpts, ScopeOpts} from './core.ts';

export type TimelineTone = 'accent' | 'danger' | 'muted';
export interface TimelineMark {
  /** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'. */
  at: string;
  label: string;
  /** Default 'muted'. */
  tone?: TimelineTone;
}
export interface TimelineOpts extends RevealOpts {
  /** The axis runs from `from` to `to` (dates as 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'). */
  from: string;
  to: string;
  /** Today. Always written out (a build never reads the clock), so the same source draws the same SVG. */
  now: {at: string; label?: string};
  /** The marker the figure is about, drawn in the danger colour. The span from `now` to it is the remaining time. */
  deadline: {at: string; label: string; /** 'full': a line through the whole height of the figure at the deadline (default: a short stem and a big dot). */ line?: 'full'};
  /** How the span from now to the deadline is drawn: 'bar' (default, a thick line on the axis) or 'fill' (a pale band above and below the axis). */
  span?: 'bar' | 'fill';
  /** Other dates on the axis (a release, a contract end). */
  marks?: TimelineMark[];
  /** The text of the remaining-span label. Default is computed ("あと 1 年 3 か月"); false hides the span label (the bar stays). */
  remaining?: string | false;
  /** A spotlight target and a connect() endpoint. */
  id?: string;
}
export interface TimelineBand extends TimelineOpts {
  type: 'timeline';
}
/** An event on a numeric axis (a dot with its label and value). */
export interface NumericTimelineEvent {at: number; label: string; /** One of `lanes` (default: the first). */ lane?: string; /** Default 'muted'. */ tone?: TimelineTone}
/** A stretch of the numeric axis: a bar (default) or, with `dim`, a dimension line with its length written above ("344ms"). */
export interface NumericTimelineSpan {
  from: number;
  to: number;
  /** Default for a dimension line: the length with the unit ("344ms"); none for a bar. */
  label?: string;
  lane?: string;
  /** Default 'accent'. */
  tone?: TimelineTone;
  /** A dimension line (two end ticks, the length above) instead of a bar. */
  dim?: boolean;
}
/** timeline({unit, from, to, ...}): a time axis of plain numbers (ms, s, steps) with lanes, events and spans. */
export interface NumericTimelineOpts extends RevealOpts {
  /** 'ms', 's', '分'...: written after every tick and event value. */
  unit: string;
  from: number;
  to: number;
  /** Tick spacing (default: 1, 2 or 5 times a power of ten, at most 8 ticks). */
  step?: number;
  /** Rows, top to bottom, each with its name at the left. Without it: one unnamed row. */
  lanes?: string[];
  events?: NumericTimelineEvent[];
  spans?: NumericTimelineSpan[];
  id?: string;
}
export interface NumericTimelineBand extends NumericTimelineOpts {
  type: 'timeline';
}
export interface GanttTask {
  label: string;
  /** Makes the bar an anchor for connect(), and nameable in `after`. */
  id?: string;
  /** 'YYYY-MM-DD'. */
  start: string;
  /** 'YYYY-MM-DD', the last day (inclusive). Or give `days`. */
  end?: string;
  days?: number;
  /** One day, drawn as a diamond. */
  milestone?: boolean;
  /** 0 - 1: how much of the bar is done. */
  progress?: number;
  /** An arrow from the end of these tasks (ids) to the start of this one. */
  after?: string | string[];
  tone?: 'accent' | 'danger' | 'muted';
}
export type GanttRow = GanttTask | {section: string};
export interface GanttOpts extends RevealOpts, ScopeOpts {
  /** The axis (default: the first start to the last end). 'YYYY-MM-DD'. */
  from?: string;
  to?: string;
  /** Today, always written out (a build never reads the clock). A line through the chart. */
  today?: string;
  todayLabel?: string;
  /** Widen the axis to include `today` when it is outside (only a side that `from` / `to` did not fix). Default false. */
  extendToToday?: boolean;
  id?: string;
}
export interface GanttBand extends GanttOpts {
  type: 'gantt';
  rows: GanttRow[];
}
export interface TimelineText extends Dimmed {text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; fill: 'text' | 'muted' | 'accent' | 'danger'; bold: boolean; size: number}
export interface LaidOutTimeline extends Rect, Dimmed {
  type: 'timeline';
  id?: string;
  reveal?: number;
  until?: number;
  axis: {x1: number; x2: number; y: number};
  /** The bar on the axis between now and the deadline (accent while the deadline is ahead, danger once past). */
  span?: {x1: number; x2: number; y: number; tone: 'accent' | 'danger'; fill?: boolean};
  /** deadline.line 'full': the vertical line through the figure. */
  fullLine?: {x: number; y1: number; y2: number};
  /** The bracket under the ticks that carries the remaining-span label. */
  bracket?: {x1: number; x2: number; y: number; tone: 'accent' | 'danger'};
  ticks: {x: number; y1: number; y2: number}[];
  /** Numeric timeline: thin lines (lane baselines and separators), bars and dimension lines. */
  guides?: {x1: number; x2: number; y: number}[];
  bars?: (Rect & {tone: 'accent' | 'danger' | 'muted'})[];
  dims?: {x1: number; x2: number; y: number; tone: 'accent' | 'danger' | 'muted'}[];
  stems: {x: number; y1: number; y2: number; tone: 'accent' | 'danger' | 'muted'}[];
  dots: {x: number; y: number; r: number; tone: 'accent' | 'danger' | 'muted'}[];
  texts: TimelineText[];
  labelBoxes: (Rect & {label: string})[];
}
export interface GanttText extends Dimmed {text: string; x: number; y: number; size: number; bold: boolean; muted: boolean; anchor: 'start' | 'middle' | 'end'; tone?: 'danger'}
export interface LaidOutGantt extends Rect, Dimmed {
  type: 'gantt';
  id?: string;
  reveal?: number;
  until?: number;
  plot: {x1: number; x2: number; y1: number; y2: number};
  ticks: {x: number}[];
  /** Section heading rows (a pale band across the figure). */
  sections: Rect[];
  /** One per task, in order (a milestone is a diamond; `progress` is the done part of a bar). */
  bars: (Rect & {label: string; tone: 'accent' | 'danger' | 'muted'; progress?: number; milestone?: boolean})[];
  /** `from` / `to`: indexes into `bars` (the task it comes after, and the task). */
  deps: {from: number; to: number; points: {x: number; y: number}[]}[];
  today?: {x: number; y1: number; y2: number};
  texts: GanttText[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}
