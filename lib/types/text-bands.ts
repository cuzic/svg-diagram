// Types: caption / box / banner (and rich text).
import type {IconGlyph} from '../icon-store.ts';
import type {IconName} from '../icons.ts';
import type {RICH} from '../rich.ts';
import type {Align, Dimmed, EmphasisTone, FontWeight, HeadlineRole, Rect, RevealOpts, Role, TagTone, TextTone} from './core.ts';

/** Box fill/stroke tone (emit.ts resolveBoxStyle). 'plain' = white with a dark border (default for box). */
export type BoxTone = 'plain' | 'accent' | 'new' | 'changed' | 'removed' | 'muted' | 'danger';
/** One piece of a line in one style. Consecutive spans of a text concatenate to its plain text. */
export interface Span {text: string; bold?: boolean; tone?: TextTone}
/** A bold / coloured piece, made by em.b() / em.danger() / ... (the brand keeps a BoxLine or any other object from passing for one). */
export interface Styled {
  readonly [RICH]: true;
  readonly bold?: boolean;
  readonly tone?: TextTone;
  readonly of: string | Styled;
}
export type RichPart = string | Styled;
/** Text as written: a string is always exactly its characters; an array mixes strings and em.* parts. */
export type RichText = string | readonly RichPart[];
/** Where a band's spans sit (the plain text stays in the band's own field). Set by the DSL functions; layout reads it. */
export interface RichSpans {title?: Span[]; body?: Span[]; note?: Span[]; headline?: Span[]; sub?: Span[]; text?: Span[]}
export interface CaptionOpts extends RevealOpts {
  align?: Align;
  role?: Role;
  tone?: TextTone;
  bold?: boolean;
  mono?: boolean;
}
export interface CaptionBand {
  type: 'caption';
  text: string;
  /** Internal: set by caption() / group(); `text` is the plain text of these. */
  spans?: RichSpans;
  align: Align;
  role: Role;
  tone: TextTone;
  bold: boolean;
  mono: boolean;
  reveal?: number;
  /** Internal: the diagram({sourceLine}) caption, which layout appends as the last band. */
  sourceLine?: boolean;
  until?: number;
}
/** One extra line of a box band: a plain string or a styled line (`spans`: internal, the pieces of `text`). */
export type BoxLine = string | {text: string; role?: Role; bold?: boolean; mono?: boolean; tone?: TextTone; spans?: Span[]};
/** One extra line as written to box(): `text` may mix em.* parts. A part on its own is not a line (it would be a separate one). */
export type BoxLineIn = string | {text: RichText; role?: Role; bold?: boolean; mono?: boolean; tone?: TextTone};
/** Fields shared by every box-like band (box, banner, swimlane step, row/grid child). */
export interface BoxChrome extends RevealOpts {
  id?: string;
  tone?: EmphasisTone;
  /** Draw the boundary dashed (overrides the tone's default). */
  dashed?: boolean;
  align?: Align;
  /** Pill on the box's top edge. */
  tag?: string;
  tagTone?: TagTone;
  /** 0..1 along the top edge where the tag is centred (default: right-aligned). */
  tagAt?: number;
  /** Small chip at the bottom-right corner ("架空の例", "イメージ", "要確認"). Reserves a strip under the content, so it never covers the text. */
  stamp?: string;
  padX?: number;
  padY?: number;
  /** row(): flex share (default 1). */
  flex?: number;
  /** row(): fixed width for justify 'center' | 'start'. */
  width?: number;
  /** row({cols}) / swimlane: 1-based start column. */
  col?: number;
  /** row({cols}) / swimlane: number of columns taken (default 1). */
  span?: number;
}
/** The box() fields that are not text (shared by the input and the band, which differ in what a text field holds). */
export interface BoxStyleOpts extends BoxChrome {
  titleTone?: TextTone;
  titleMono?: boolean;
  bodyTone?: TextTone;
  bodyMono?: boolean;
  noteTone?: TextTone;
  /** Number/string badge on the title's baseline. Requires `title`. */
  step?: number | string;
  /** An SVG pictogram at the box's left edge (32px); the text is indented to clear it. With `step` the badge sits right of the icon. Put a label beside it: the icon alone is hidden from screen readers. */
  icon?: IconName;
  /** Colour of the icon (default 'text'); a dimmed box draws it muted. */
  iconTone?: TextTone;
  /** Where the icon goes: 'left' (default, 32px, text beside it) or 'top' (centred above the text, `iconSize` px — see node()). */
  iconAt?: 'left' | 'top';
  /** Side of the icon when it is at the top (default 48). */
  iconSize?: number;
  /** `false`: no box around it (node() — an icon with its label, as in an architecture diagram). */
  frame?: false;
  /**
   * @deprecated Has no effect: layout and emit never read it. For big text use a role: stat() / stat({size: 'display'}),
   * caption({role: 'display'}), banner({headlineRole}), bars / plane({labelRole}). box({size}) still passes its px check
   * (14..72) and warns; the next version throws.
   */
  size?: number;
}
export interface BoxOpts extends BoxStyleOpts {
  title?: RichText;
  body?: RichText;
  lines?: BoxLineIn[];
  note?: RichText;
}
/** A box band holds plain text only; the pieces of a rich text are in `spans`. */
export interface BoxBand extends BoxStyleOpts {
  type: 'box';
  /** Internal: the installed path of `icon`, resolved by box(). */
  iconGlyph?: IconGlyph;
  title?: string;
  body?: string;
  lines?: BoxLine[];
  note?: string;
  /** Internal: set by box() / swimlane(); `title` / `body` / `note` are the plain text of these. */
  spans?: RichSpans;
  /** Internal: stat() keeps its first line on one line and verify reports overflow. */
  statValue?: string;
  /** Internal: stat({source, confidence}) keeps what it printed on its third line; the stat-no-source check reads it (ADR 0023 D9). */
  evidence?: {source: string; confidence?: StatConfidence};
}
/** How strong the evidence for a stat() number is (ADR 0023 D7). Drawn as a symbol plus a word, never as a colour. */
export type StatConfidence = 'primary' | 'secondary' | 'unverified';
export interface StatOpts extends Pick<BoxChrome, 'id' | 'flex' | 'width' | 'col' | 'span' | 'reveal' | 'until'> {
  /** The value's text colour; 'accent' also fills the card with the accent tone's fill; 'solid' / 'solid-danger' instead fill the whole box (white text) as in box({tone}). */
  tone?: TextTone | 'solid' | 'solid-danger';
  size?: 'stat' | 'display';
  /** Where the number comes from (one line, plain text). Printed as a third line `出典: <source>` (ADR 0023). */
  source?: string;
  /** How strong the source is: 'primary' ◎ 一次資料 / 'secondary' ○ 報道・二次資料 / 'unverified' △ 未確認. Needs `source`. */
  confidence?: StatConfidence;
}
export interface BannerStyleOpts extends BoxChrome {
  headlineTone?: TextTone;
  /** The headline's text role (default 'banner' = 16px; 'stat' 34px, 'display' 56px). */
  headlineRole?: HeadlineRole;
  /** Default 'muted'. */
  subTone?: TextTone;
}
export interface BannerOpts extends BannerStyleOpts {
  headline: RichText;
  sub?: RichText;
}
export interface BannerBand extends BannerStyleOpts {type: 'banner'; tone: EmphasisTone; headline: string; sub?: string; /** Internal: see BoxBand. */ spans?: RichSpans}
/** One text run of a box-like band, before wrapping (layout.ts textRuns). */
export interface TextRun {
  text: string;
  size: number;
  weight: FontWeight;
  mono: boolean;
  tone?: TextTone;
  /** The pieces of `text` when part of it is bold / in a tone (concatenate to `text`); absent for plain text. */
  spans?: Span[];
  /** Pixels the first line is pushed right (to clear a step badge). */
  indent?: number;
  /** A stat value is semantically atomic and must not wrap. */
  nowrap?: boolean;
  /** A `nowrap` run that may be drawn smaller when it does not fit: down to `min` px, in whole pixels (ADR 0024). */
  fit?: {min: number};
}
/** A text run after wrapping: `lines[i]` is drawn with its baseline at band.y + padY + lineYs[i]. */
export interface WrappedRun extends TextRun {
  lines: string[];
  lineYs: number[];
  /** Per line, the pieces of `lines[i]` (only when the run has spans). */
  lineSpans?: Span[][];
  /** Set only when a `fit` run was drawn smaller than asked: the size it was asked for (`size` is what it is drawn at). */
  shrunkFrom?: number;
}
export interface LaidOutCaption extends CaptionBand, Rect, Dimmed {
  wrappedRuns: WrappedRun[];
  tagBox?: Rect;
  /** group() titles only: the rect the title's text really covers (the caption itself spans the whole frame width). */
  inkBox?: Rect;
}
export interface LaidOutBox extends BoxBand, Rect, Dimmed {wrappedRuns: WrappedRun[]; tagBox?: Rect; stampW?: number; nowrapOverflow?: {value: string; width: number; avail: number; min: number}[]; /** stat() values drawn smaller than their role's size so they fit (ADR 0024). */ statShrunk?: {value: string; from: number; to: number}[]; /** With `step` and a centred / right-aligned title: its first line's width (the badge sits just before it). */ titleW?: number}
export interface LaidOutBanner extends BannerBand, Rect, Dimmed {wrappedRuns: WrappedRun[]; tagBox?: Rect; stampW?: number}
