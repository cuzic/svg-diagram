// Types: sequence, table and swimlane.
import type {IconGlyph} from '../icon-store.ts';
import type {IconName} from '../icons.ts';
import type {Align, Arrow, Bend, Dimmed, LineStyle, Rect, RevealOpts, ScopeOpts, TextTone} from './core.ts';
import type {BoxBand, BoxOpts, BoxTone, LaidOutBox} from './text-bands.ts';

export interface SequenceActor {
  id: string; label: string; tone?: BoxTone;
  /** An installed SVG icon (see `icon`) above the label in the header, 20px, in `iconTone` (default: the label's text colour). The label carries the meaning, so the icon is `aria-hidden`. */
  icon?: IconName;
  iconTone?: TextTone;
  /** Internal: the installed path of `icon`, resolved by sequence(). */
  iconGlyph?: IconGlyph;
}
/** A message between two participants. */
export interface SeqMessage {
  from: string;
  to: string;
  label: string;
  line?: LineStyle;
  arrow?: Arrow;
  tone?: TextTone;
  /** false: do not number this message. */
  number?: false;
  self?: never; note?: never; divider?: never;
}
/** A call to the same participant. */
export interface SeqSelf {
  self: string;
  label: string;
  line?: LineStyle;
  tone?: TextTone;
  number?: false;
  from?: never; to?: never; note?: never; divider?: never;
}
/** A note box over one or more participants. */
export interface SeqNote {
  note: string;
  over: string | string[];
  tone?: BoxTone;
  from?: never; to?: never; self?: never; divider?: never;
}
/** A phase separator across the whole width. */
export interface SeqDivider {
  divider: string;
  from?: never; to?: never; self?: never; note?: never;
}
export type SequenceStep = SeqMessage | SeqSelf | SeqNote | SeqDivider;
export interface SequenceOpts extends RevealOpts {
  /** false: do not auto-number messages. */
  numbered?: boolean;
  id?: string;
}
export interface SequenceBand {
  type: 'sequence';
  actors: SequenceActor[];
  steps: SequenceStep[];
  numbered?: boolean;
  id?: string;
  reveal?: number;
  until?: number;
}
/** prepareSequence(): a step with its kind resolved, `text` = the (numbered) label, note.over always an array. */
export type PreparedStep =
  | (SeqMessage & {kind: 'msg'; text: string})
  | (SeqSelf & {kind: 'self'; text: string})
  | (Omit<SeqNote, 'over'> & {kind: 'note'; text: string; over: string[]})
  | (SeqDivider & {kind: 'divider'; text: string});
export interface PreparedSequence extends Omit<SequenceBand, 'steps'> {steps: PreparedStep[]}
export interface TableColumn {
  /** Header text. A table with no labelled column has no header row. */
  label?: string;
  flex?: number;
  mono?: boolean;
  bold?: boolean;
  align?: Align;
}
/** A status symbol that goes in front of a table cell's text: ok ○ | mid △ | ng × | best ◎ (the symbol carries the meaning, the tone only reinforces it). */
export type CellMark = 'ok' | 'mid' | 'ng' | 'best';
export interface TableCellSpec {
  text?: string; tone?: TextTone; bold?: boolean; mono?: boolean; align?: Align;
  /** Vertical alignment in a fixed-height row. The default is center. */
  vAlign?: 'top' | 'center';
  /** Draws the symbol + a default tone before `text` (an explicit `tone` / `bold` wins); without `text` the cell is the symbol alone. */
  mark?: CellMark;
  /** An installed SVG icon (see `icon`) before the text, 18px, in the text's tone (or `iconTone`). Alone (no text) it is the cell's content: it gets `role="img"`. */
  icon?: IconName;
  iconTone?: TextTone;
  /** Internal: the installed path of `icon`, resolved by table(). */
  iconGlyph?: IconGlyph;
}
export type TableCell = string | number | TableCellSpec;
/** `h`: this row's fixed height (wins over `cellH`; text centred vertically; throws when a cell needs more). */
export type TableRow = readonly TableCell[] | {cells: readonly TableCell[]; tone?: BoxTone; h?: number};
export interface TableOpts extends RevealOpts {
  /** Accent bar on top (an ER entity name, a caption). */
  title?: string;
  /** false hides the column-label row. */
  header?: boolean;
  /** Narrows the table (centred). */
  width?: number;
  tone?: BoxTone;
  /** Fixed height of every row (header included), text centred vertically. Throws when a cell's text needs more. */
  cellH?: number;
  /** Fixed height of the header row (wins over `cellH`). */
  headerH?: number;
  /** Top and bottom padding of a row 4px instead of 8px (text stays 14px). `cellH` / `h` / `headerH` still win; the height a row needs is computed with the dense padding. */
  dense?: boolean;
  /** The left column is a row heading: its body cells are bold on a `soft` fill, with a heavy rule on their right (the top-left cell stays a header cell). Warns (`rowheader-tone-collides`) when a row's own tone also fills `soft`. */
  rowHeader?: boolean;
  id?: string;
}
export interface TableBand {
  type: 'table';
  columns: TableColumn[];
  rows: TableRow[];
  title?: string;
  header?: boolean;
  width?: number;
  tone?: BoxTone;
  cellH?: number;
  headerH?: number;
  dense?: boolean;
  rowHeader?: boolean;
  id?: string;
  reveal?: number;
  until?: number;
  /** Domain warnings attached by a semantic table constructor and reported by svg-diagram check. */
  semanticWarnings?: readonly string[];
  /** A small score curve drawn in the lower part of one body row (used by journeyMap's emotion lane). */
  rowCurve?: {row: number; values: readonly number[]; min: number; max: number};
}
/** cellOf(): a cell with column defaults applied. */
export interface ResolvedCell {text: string; tone?: TextTone; bold: boolean; mono: boolean; align: Align; vAlign?: 'top' | 'center'; icon?: CellIcon}
/** The icon of a table cell: what to draw and in which tone. */
export interface CellIcon {name: string; glyph: IconGlyph; tone?: TextTone}
export interface SwimlaneLane {
  id: string;
  label: string;
  tone?: BoxTone;
  /** `svg-diagram check` never suggests moving this lane. */
  fixed?: boolean;
}
/** A step: any box() field, plus the lane it sits in. Columns are time; `row` stacks overlapping work of one lane. */
export interface SwimlaneStep extends BoxOpts {
  lane: string;
  row?: number;
}
export interface SwimlaneFlow {
  /** Step id, or 'id:side[@t]'. */
  from: string;
  to: string;
  label?: string;
  chip?: boolean;
  line?: LineStyle;
  arrow?: Arrow;
  bend?: Bend;
  bendOffset?: number;
  labelAt?: number;
  tone?: TextTone;
}
/** Column group named across the top (a stage, a sprint). */
export interface SwimlanePhase {label: string; from: number; to: number}
export interface SwimlaneOpts extends RevealOpts, ScopeOpts {
  flows?: SwimlaneFlow[];
  phases?: SwimlanePhase[];
  /** Width of the lane-label column (default 128). */
  labelW?: number;
  colGap?: number;
  /** 'shrink': when the columns come out narrower than ~112px, narrow the lane-label column and the column gaps (down to 88 / 12px) to give them room. Default: the sizes above, as given. */
  fit?: 'shrink';
  id?: string;
}
/** A step after swimlane() placed it in a column. */
export interface SwimlaneStepBand extends BoxBand {
  lane: string;
  row?: number;
  col: number;
  span: number;
}
export interface SwimlaneBand {
  type: 'swimlane';
  lanes: SwimlaneLane[];
  steps: SwimlaneStepBand[];
  /** Number of columns used. */
  cols: number;
  phases?: SwimlanePhase[];
  labelW?: number;
  colGap?: number;
  fit?: 'shrink';
  id?: string;
  reveal?: number;
  until?: number;
}
/** The swimlane frame (lane backgrounds, labels, phases); its steps follow as separate LaidOutStep bands. */
export interface LaidOutLane {
  y: number; h: number;
  labelLines: string[];
  labelTop: number;
  tone?: BoxTone;
  /** Tallest step of this lane. */
  maxStep: number;
  blockTop: number;
}
export interface LaidOutPhase {x: number; w: number; lines: string[]}
export interface LaidOutSwimlane extends Rect {
  type: 'swimlane';
  labelW: number;
  bodyX: number;
  phaseH: number;
  phases: LaidOutPhase[];
  lanes: LaidOutLane[];
  /** With `fit: 'shrink'`: the steps whose text broke into lines of 2.5 characters or fewer on average (the shrink-narrow-text rule reads it). */
  narrow?: string[];
  id?: string;
  reveal?: number;
  until?: number;
}
/** A swimlane step as laid out: a box that remembers its lane. */
export interface LaidOutStep extends LaidOutBox {lane: string; row?: number; col: number; span: number}
export interface LaidOutSeqHead extends Rect {
  id: string; tone?: BoxTone; lines: string[]; cx: number;
  /** Top of the label's first line, relative to the head's top (an icon above it, or the label centred in a head that is taller than its text). */
  textDy: number;
  icon?: {name: string; glyph: IconGlyph; x: number; y: number; size: number; tone?: TextTone};
}
export interface LaidOutSeqMsg {kind: 'msg'; x1: number; x2: number; y: number; lines: string[]; labelTop: number; lx: number; line: LineStyle; arrow: Arrow; tone?: TextTone}
export interface LaidOutSeqSelf {kind: 'self'; cx: number; y: number; loopH: number; lines: string[]; lx: number; side: 'left' | 'right'; labelTop: number; line: LineStyle; tone?: TextTone}
export interface LaidOutSeqNote extends Rect {kind: 'note'; lines: string[]; tone: BoxTone}
export interface LaidOutSeqDivider {kind: 'divider'; y: number; x1: number; x2: number; cx: number; chipW: number; text: string}
export type LaidOutSeqStep = LaidOutSeqMsg | LaidOutSeqSelf | LaidOutSeqNote | LaidOutSeqDivider;
export interface LaidOutSequence extends Rect {
  type: 'sequence';
  id?: string;
  reveal?: number;
  until?: number;
  heads: LaidOutSeqHead[];
  steps: LaidOutSeqStep[];
  lifeTop: number;
  lifeBottom: number;
}
export interface LaidOutTableCell {text: string; tone?: TextTone; bold: boolean; mono: boolean; align: Align; vAlign?: 'top' | 'center'; lines: string[]; x: number; w: number; top: number; icon?: CellIcon; /** With an icon and centred / right-aligned text: the first line's width (the icon goes just before it). */ lineW?: number}
export interface LaidOutTableRow {y: number; h: number; cells: LaidOutTableCell[]; header?: boolean; tone?: BoxTone}
export interface LaidOutTable extends Rect, Dimmed {
  type: 'table';
  id?: string;
  titleBar: {y: number; h: number; lines: string[]} | null;
  rows: LaidOutTableRow[];
  /** Left edge of every column. */
  colX: number[];
  colW: number[];
  tone?: BoxTone;
  /** The left column of the body rows is a row heading (see TableOpts.rowHeader). */
  rowHeader?: boolean;
  reveal?: number;
  until?: number;
  /** font-size of the cell text at layout time (the smallest text of the table; fit.ts counts it). */
  bodySize: number;
  /** Curve points and its neutral-score guide (the middle of the range, where the marks switch), wholly inside a reserved table row. */
  rowCurve?: {points: {x: number; y: number}[]; midY: number; top: number; bottom: number};
}
