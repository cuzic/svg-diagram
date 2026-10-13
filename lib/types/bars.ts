// Types: bars.
import type {Anchor, ColorKey, Dimmed, LabelRole, Rect, RevealOpts} from './core.ts';

export type BarSeries = 'a' | 'b' | 'c';
export type BarTone = 'accent' | 'danger' | 'muted';
export interface BarDatum extends RevealOpts {
  label: string; value: number;
  /** a: accent (blue), b: dark text colour, c: muted. */
  series?: BarSeries;
  /** The bar's colour by tone (accent / danger / muted); `danger` is the red. Not together with `series`. */
  tone?: BarTone;
  id?: string;
  /** The id of an earlier bar of this band to take the place of: this bar sits in that bar's row / column, which vanishes (`until`) when this one appears (`reveal`, required). Not with `stack`. */
  replaces?: string;
}
export interface BarsOpts extends RevealOpts {
  /** A spotlight target (the bars inside it too) and a connect() endpoint (the whole band); it may not repeat a bar's id. */
  id?: string;
  /** The text role of every label of the figure (category, value, tick). Default 'note' (14px). Bars and the row pitch grow with it. */
  labelRole?: LabelRole;
  max?: number;
  unit?: string;
  /** How a bar's value is written. Default: whole numbers exactly (1055 stays 1055), others to 3 significant digits but keeping the whole part (1055.5 is 1056). 'exact' writes the number as given; a number is the decimals; a function formats it yourself. */
  valueFormat?: 'exact' | number | ((value: number) => string);
  dir?: 'h' | 'v';
  stack?: boolean;
  /** Figure height. Vertical bars default to 280; horizontal bars derive it from their count. */
  height?: number;
  /** Which labels to draw: both (default), the category labels only, or none. */
  labels?: 'all' | 'category' | 'none';
  /** false drops the scale: tick numbers, tick lines and the value axis. The category baseline stays (see `baseline`). Default true. */
  axis?: boolean;
  /** Lines across the plot at each tick. Follows `axis`; true needs `axis` on. */
  grid?: boolean;
  /** The line the bars stand on (or start from). Default true. */
  baseline?: boolean;
  /** Bar share of its slot (0 < r <= 1). Given: no upper width limit, 1 makes neighbours touch. Omitted: the usual look. Not for `stack`. */
  barRatio?: number;
  /** Leave out the value label of a bar that is 0 (a histogram's empty classes). */
  hideZero?: boolean;
  /** Vertical bars only: horizontal reference lines (a target, a mean, a limit) at a value of the bars' axis. */
  lines?: BarsLine[];
  /** Vertical bars only: vertical reference lines at a position along the bars (in bar slots: 0 is the left edge of the first bar, 1 the edge between the first and the second). A histogram's specification limits and mean. */
  vlines?: BarsLine[];
  /** Vertical bars only: a curve over the bars through [slot position, value] points (a histogram's normal curve). */
  curve?: {through: [slot: number, value: number][]; tone?: BarsTone; dashed?: boolean};
  /** Vertical bars only: a Pareto's cumulative line on a 0-100% axis on the right (`max` must be the total: 100% is then the top of the plot). `guide`: a dashed line at that percent (80). */
  cumulative?: {guide?: number};
  /** Vertical bars only: labels at the edges between bars (one more than there are bars), written under the edges instead of under the bars. A histogram's class boundaries. Not with `labels: 'none'`. */
  edges?: string[];
}
export type BarsTone = 'accent' | 'danger' | 'muted' | 'text';
export interface BarsLine {at: number; label?: string; tone?: BarsTone; /** Default true. */ dashed?: boolean}
export interface BarsBand extends BarsOpts {
  type: 'bars';
  data: BarDatum[];
  max: number;
  dir: 'h' | 'v';
  stack: boolean;
  /** Its own, or the enclosing group's; each bar has its own too. */
  reveal?: number;
  until?: number;
}
export interface BarRect extends Rect, Dimmed {fill: ColorKey; id?: string; reveal?: number; until?: number}
/** `bar`: index into `bars` of the bar the label belongs to (none for tick labels), so spotlight can dim it with its bar. */
export interface BarText extends Dimmed {text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; fill: ColorKey; size: number; bold?: boolean; reveal?: number; until?: number; bar?: number}
export interface BarsInk {
  /** `soft`: it may cross labels (the curve laid over a histogram); every other line is kept clear of them. */
  lines: {x1: number; y1: number; x2: number; y2: number; fill: ColorKey; dashed: boolean; soft?: boolean}[];
  polylines: {pts: {x: number; y: number}[]; fill: ColorKey; dashed: boolean; soft?: boolean}[];
  dots: {x: number; y: number; fill: ColorKey}[];
}
export interface LaidOutBars extends Rect, Dimmed {
  type: 'bars';
  /** Reference lines, the cumulative line and the curve of a bars() with those options. */
  ink?: BarsInk;
  id?: string;
  dir: 'h' | 'v';
  stack: boolean;
  reveal?: number;
  until?: number;
  bars: BarRect[];
  ticks: {x1: number; y1: number; x2: number; y2: number}[];
  texts: BarText[];
  labelBoxes: (Rect & {label: string; background?: ColorKey; bar?: number})[];
  anchors: Anchor[];
}
