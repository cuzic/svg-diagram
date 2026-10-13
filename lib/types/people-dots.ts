// Types: people and dots.
import type {Rect, Theme} from './core.ts';

export type PeopleTone = 'accent' | 'danger' | 'muted';
/** A number (and a line under it) set to the right of the grid. */
export interface PeopleSide {
  /** The big text, e.g. '76%' or '76 人'. */
  value: string;
  /** A line under it. */
  label?: string;
  /** Colour of the value (default: the normal text colour). */
  tone?: 'accent' | 'danger' | 'muted';
  /** 'stat' (34px, default) or 'display' (56px). */
  size?: 'stat' | 'display';
}
export interface PeopleOpts {
  /** Icons per row. Default: the whole count when it is 10 or fewer, else the square root rounded up (100 -> 10). */
  cols?: number;
  /** Icon height in px (default 28). */
  size?: number;
  /** Gap between icons in px (default 8). */
  gap?: number;
  /** Where the grid sits in the column (default 'center'). */
  align?: 'left' | 'center';
  /** Colour of the emphasized (filled) icons (default 'accent'; 'muted' for a grey figure). The others are outlines, so the count reads without colour. */
  tone?: PeopleTone;
  /** Colour of the second group when `count` is [k1, k2] (default 'danger', or 'accent' when `tone` is 'danger'). */
  tone2?: PeopleTone;
  /** Colour of the outlined icons (default 'muted'). */
  rest?: PeopleTone;
  /** A number beside the grid, vertically centred on it: the figure and its number in one band. */
  side?: PeopleSide;
  /** The accessible name (default "k / total"). */
  alt?: string;
  id?: string;
}
export interface PeopleBand {
  type: 'people';
  total: number;
  count: number;
  /** Icons of the second emphasized group, after the first `count` (0 when there is none). */
  count2: number;
  cols: number;
  size: number;
  gap: number;
  align: 'left' | 'center';
  tone: PeopleTone;
  tone2: PeopleTone;
  rest: PeopleTone;
  side?: PeopleSide;
  alt: string;
  id?: string;
}
export interface LaidOutPeople extends Rect {
  type: 'people'; id?: string; day: Theme; tone: PeopleTone; tone2: PeopleTone; rest: PeopleTone; alt: string; size: number;
  texts: {text: string; x: number; y: number; size: number; bold: boolean; tone?: 'accent' | 'danger' | 'muted'}[];
  /** Top-left of every icon, emphasized ones first. */
  icons: {x: number; y: number; on: boolean; second?: true}[];
}
export type DotTone = 'accent' | 'danger' | 'muted';
/** A dot's position on the lane (in the lane's own units), and optionally its tone. */
export type DotDatum = number | {at: number; tone?: DotTone};
export interface DotZone {
  /** The span of the lane, in the lane's own units. */
  from: number;
  to: number;
  /** Text under the span. */
  label: string;
  /** Colour of the span's bar and of the dots inside it that have no tone of their own (default 'danger'). */
  tone?: DotTone;
}
export interface DotsOpts {
  /** The lane's range (default 0 .. 1). */
  min?: number;
  max?: number;
  /** Text at the left / right end of the lane. */
  lowLabel?: string;
  highLabel?: string;
  /** Spans of the lane to mark: a bar on the lane, its label under it, and the tone of the dots inside. */
  zones?: DotZone[];
  /** Dot radius in px (default 10). */
  r?: number;
  /** The figure's width (default: the column). */
  width?: number;
  /** The figure's height; it must hold the tallest pile (default: just that). */
  height?: number;
  /** The accessible name (default "N dots"). */
  alt?: string;
  id?: string;
}
export interface DotsBand {
  type: 'dots';
  dots: {at: number; tone?: DotTone}[];
  min: number;
  max: number;
  lowLabel?: string;
  highLabel?: string;
  zones: Required<DotZone>[];
  r: number;
  width?: number;
  height?: number;
  alt: string;
  id?: string;
}
export interface LaidOutDots extends Rect {
  type: 'dots'; id?: string; day: Theme; alt: string; r: number;
  axis: {x1: number; x2: number; y: number};
  dots: {x: number; y: number; tone: DotTone}[];
  zones: {x: number; w: number; y: number; tone: DotTone; top: number}[];
  texts: {text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; size: number}[];
}
