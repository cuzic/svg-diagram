// Domain types for svg-diagram (types only: nothing in this file exists at runtime).
//
// Layers, in the order data flows through them:
//   1. DSL input   — XxxOpts (what a caller passes to diagram() / box() / wf.col() ...)
//   2. Bands       — Band: what the DSL constructors return (a vertical stack, discriminated on `type`)
//   3. Laid out    — LaidOutBand / LaidOutDiagram: layout.ts output, every band has x/y/w/h
//   4. Verdicts    — Finding / Verdict / FitReport: rules.ts, verify.ts, fit.ts output
//
// Conventions:
//   * Laid-out objects are MUTABLE on purpose (layout.ts creates a band, then fixes h / y / tagBox.y
//     once siblings are known). Do not mark their fields readonly.
//   * Optional (`?`) means "the DSL constructor may leave this undefined", not "may be missing at runtime
//     after defaults were applied" — a constructor that defaults a field (e.g. row().gap) returns it required.
//   * Colours are never raw strings in the DSL: they are token keys (TextTone / BoxTone / ColorKey).

import type {BadgeBox} from './badge.ts';
import type {IconName} from './icons.ts';
import type {IconGlyph} from './icon-store.ts';
import type {ConnectInput, DeclaredIds, RefIn, ValidateBands} from './strict.ts';
import type {RULE_DOCS, DEFAULT_LEGEND_LABELS} from './rules.ts';
import type {RICH} from './rich.ts';

// ============================================================================================
// Tokens, tones, lines
// ============================================================================================

/** Palette keys diagram() accepts: 1 / 2 (the training deck's legacy day numbers) or a named theme. */
export type Theme = 1 | 2 | 'blue' | 'teal' | 'amber';
/** 'light' (default) | 'dark': which token set the diagram is drawn with (tokens.ts DARK_PALETTE). */
export type Appearance = 'light' | 'dark' | {dark: Partial<DarkTokens>};
/** The dark token set, replaceable per diagram: `appearance: {dark: {bg: '#0b1220', text: '#ffffff', accent: '#60a5fa'}}`. accent / soft replace those of every theme. */
export interface DarkTokens {bg: string; text: string; muted: string; border: string; code: string; danger: string; accent: string; soft: string}
/** 'slide' (legacy `day:` diagrams, get slide-fit warnings) | 'doc' (`theme:` diagrams: title/desc metadata, full rule set). */
export type Medium = 'slide' | 'doc';

/** Accent + soft colours of one theme. */
export interface ThemeColors {accent: string; soft: string}
/** Colour keys PALETTE holds directly (everything that is not a theme). */
export type PlainColorKey = 'bg' | 'text' | 'muted' | 'border' | 'code' | 'danger';
export type Palette = Record<PlainColorKey, string> & Record<Theme, ThemeColors>;
/** Token key a wireframe primitive carries; emit.ts resolves it against the diagram theme ('accent' | 'soft' are theme colours). */
export type ColorKey = PlainColorKey | 'accent' | 'soft';

/** font-size role (tokens.ts ROLES). */
export type Role = 'title' | 'label' | 'body' | 'note' | 'banner' | 'stat' | 'display';
/** The font size (px) of every role: a value, so a figure's text sizes travel with it (tokens.ts ROLES, scaleRoles). */
/** Role sizes. `connectLabel` / `tag` (the fixed-size text that is not a role) are set only by a canvas diagram, which scales them too; absent means the 14px constants. */
export type Roles = Readonly<Record<Role, number>> & {readonly connectLabel?: number; readonly tag?: number};
/** The roles a banner() headline can be set in (default 'banner'). */
export type HeadlineRole = 'banner' | 'stat' | 'display';
/** The roles the labels of a bars() / plane() (axis labels, value labels, ticks) can be set in (default 'note'). */
export type LabelRole = 'note' | 'banner' | 'stat';
export type FontFamily = 'sans' | 'mono' | 'emoji';
export type FontWeight = 400 | 700;

/** Text colour tone (emit.ts resolveTextColor; 'text' = default). */
export type TextTone = 'text' | 'accent' | 'muted' | 'danger';
/** Box fill/stroke tone (emit.ts resolveBoxStyle). 'plain' = white with a dark border (default for box). */
export type BoxTone = 'plain' | 'accent' | 'new' | 'changed' | 'removed' | 'muted' | 'danger';
/**
 * What box() / banner() / stat() / a swimlane step / a legend item accept: BoxTone plus the filled 'solid' / 'solid-danger'
 * (accent / danger fill, white text). group, table rows, sequence and swimlane lanes stay on BoxTone: their children / cells
 * carry dark text that would sit on the fill.
 */
export type EmphasisTone = BoxTone | 'solid' | 'solid-danger';
/** Tone of the little tag pill on a box ('accent' default). */
export type TagTone = 'accent' | 'muted' | 'danger';
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'double';
/** Thickness of an arrow, by meaning (not by px): 'strong' = a thick line, e.g. the same force on both sides. Unset = the normal line. Not with line 'double'. */
export type ArrowWeight = 'strong';
/** Arrowheads of a line: 'end' (default) | 'start' | 'both' | 'none'. */
export type Arrow = 'end' | 'start' | 'both' | 'none';
export type Route = 'straight' | 'elbow' | 'loop-under';
/** Where an elbow's middle leg sits: 0..1 along the way, 'start' / 'end' hug that endpoint, 'auto' = first candidate crossing no box. */
export type Bend = number | 'start' | 'end' | 'auto';
export type Side = 'left' | 'right' | 'top' | 'bottom' | 'center';
/** Every rule id `svg-diagram check` can report (the keys of rules.ts RULE_DOCS, so the two cannot drift). */
export type RuleId = keyof typeof RULE_DOCS;
/** Legend keys of a notation: 'line:dashed' | 'arrow:both' | 'weight:strong' | 'tone:new' ... (the keys of rules.ts DEFAULT_LEGEND_LABELS). */
export type NotationKey = keyof typeof DEFAULT_LEGEND_LABELS;
export type Align = 'left' | 'center' | 'right';

// ============================================================================================
// Geometry
// ============================================================================================

export interface Point {x: number; y: number}
export interface Rect {x: number; y: number; w: number; h: number}
export interface Dimmed {/** Set on laid-out elements outside diagram({spotlight}). */ dim?: boolean}
/** A named rect connect() can attach to: any band/child with an `id` (boxes, groups, screens, ...). */
export interface Anchor extends Rect {id: string}
/** Result of parsing a connect() ref 'id', 'id:side' or 'id:side@t'. */
export interface ConnectRef {id: string; side: string; at: number}

// ============================================================================================
// DSL input: diagram()
// ============================================================================================

/** diagram({canvas}): the fixed slide canvas the diagram is drawn on. `minText` is the smallest text size (px, in the canvas's own units) the lint accepts. */
export interface SlideCanvas {width: number; height: number; minText: number}

/** Slide the diagram will be shown on (slide-budget.ts measures its free area). */
export interface SlideRef {page: string; heading: string}

/** diagram({connectDefaults}): connect() options every connector of the diagram starts from (an option given on the connector wins). */
export interface ConnectDefaults {
  route?: Route;
  /** Applies to connectors that have a `label`. */
  chip?: boolean;
  arrow?: Arrow;
  line?: LineStyle;
  tone?: TextTone;
  labelAt?: number;
  /** Elbow connectors only. */
  bend?: Bend;
  bendOffset?: number;
  /** loop-under connectors only. */
  dip?: number;
}

export interface DiagramOpts {
  /** Theme name (or 1 | 2). One of `theme` / `day` is required. */
  theme?: Theme;
  /** Legacy spelling of `theme` for the training deck (1 | 2). */
  day?: 1 | 2;
  /** Defaults to 'slide' when built from `day`, 'doc' when from `theme`. */
  medium?: Medium;
  /** 'dark' draws with the dark token set (light text on a dark page). Contrast checks use the dark colours. */
  appearance?: Appearance;
  /** true: no page-colour background rectangle (the diagram sits on whatever is behind it). Checks assume the page colour of `appearance`. */
  transparent?: boolean;
  /** SVG <title> (doc medium). Falls back to the first caption / banner headline / group title. */
  title?: string;
  /** SVG <desc> (doc medium). Falls back to a generated summary. */
  desc?: string;
  /** {'rule-id': 'why this finding is fine'}: shown as info instead of a warning. */
  accept?: Partial<Record<RuleId, string>>;
  /** 'auto' adds a legend entry for every notation used but not listed. */
  legend?: 'auto';
  legendLabels?: Partial<Record<NotationKey, string>>;
  width?: number;
  pad?: number;
  gap?: number;
  /** Slide room for the <img> (fit.ts). */
  maxDisplayHeight?: number;
  minEffectiveFont?: number;
  slide?: SlideRef;
  /** A whole-slide 16:9 canvas (1280x720 by default) shown 1:1, with a minimum text size lint. Not with `slide` / `fill`. */
  canvas?: 'slide' | Partial<SlideCanvas>;
  /** fit-figure slide: build to the measured slot, growing fonts to use the slack. Needs `slide`. */
  fill?: boolean;
  /** Options every connect() / branch() of this diagram starts from; see ConnectDefaults. */
  connectDefaults?: ConnectDefaults;
  /** What every wireframe() / screens() item starts from (a common app bar, frame, height); see WireframeDefaults. */
  wireframeDefaults?: WireframeDefaults;
  /** Keep these anchors prominent and render the rest with the muted spotlight treatment. */
  spotlight?: SpotlightOpt;
  /** A source / citation line pinned as the last line of the figure (left-aligned, muted, one line). See README. */
  sourceLine?: string;
}

/**
 * What diagram({spotlight}) takes: the anchor id(s) to keep prominent, or an object with more.
 * `edges`: which connectors stay prominent ('touching': one end is a target; 'between': both are).
 * `dim`: how a bar outside the spotlight is drawn. 'outline' (default) is a dotted outline on white; 'fill' keeps a pale fill
 * (the border colour) so the bar's length can still be read.
 * `mutedOk`: the muted-tone boxes next to the spotlight are meant (you have checked dim and muted still tell apart), so check does not warn `spotlight-muted`.
 */
export type SpotlightOpt = string | {ids: string | readonly string[]; edges?: 'touching' | 'between'; dim?: 'outline' | 'fill'; mutedOk?: boolean};

/** Everything diagram() stores, plus fields set later by build/check (usableWidth, maxWidth, source). */
export interface DiagramData {
  /** Theme key. (Named `day` for historical reasons; it holds any Theme.) */
  day: Theme;
  medium: Medium;
  appearance?: Appearance;
  transparent?: boolean;
  title?: string;
  desc?: string;
  accept?: Partial<Record<RuleId, string>>;
  legend?: 'auto';
  legendLabels?: Partial<Record<NotationKey, string>>;
  width: number;
  pad: number;
  gap: number;
  maxDisplayHeight?: number;
  minEffectiveFont?: number;
  slide?: SlideRef;
  canvas?: SlideCanvas;
  fill: boolean;
  connectDefaults?: ConnectDefaults;
  wireframeDefaults?: WireframeDefaults;
  spotlight?: SpotlightOpt;
  sourceLine?: string;
  bands: Band[];
  /** Set by build() from the measured slide (contentWidth). */
  usableWidth?: number;
  /** Project / diagram max width for the doc-width rule (config.ts applyConfig). */
  maxWidth?: number;
  /** Provenance embedded as <metadata> (build-diagram.ts / check-diagram.ts). */
  source?: DiagramSource;
  /** Internal reveal analysis, filled before layout. */
  maxReveal?: number;
  revealWarnings?: string[];
}

/** What goes in the SVG's <metadata id="svg-diagram">. */
export interface DiagramSource {
  generator?: string;
  toolVersion?: string;
  source?: string;
  sourceSha256: string;
  /** sha256 of the .svg-diagram.json in force, when there was one (build --stale compares it). */
  configSha256?: string;
  /** sha256 over the local files the source imports (lib/source-deps.ts), when there are any. */
  depsSha256?: string;
  /** Cumulative reveal stage represented by this file. */
  reveal?: number;
  until?: number;
}

export interface RevealOpts {reveal?: number; /** The click this element vanishes at (it is shown from `reveal` up to, not including, `until`). */ until?: number}

/**
 * What diagram() returns. `add()` accepts bands and arrays of bands (swimlane() / branch() return arrays).
 * `Ids` = the anchor ids declared so far (lib/strict.ts): add() rejects a connect() whose ref names an id that is
 * neither among them nor declared in the same call. Plain `Diagram` (= `Diagram<string>`) checks nothing.
 */
export interface Diagram<Ids extends string = string> extends DiagramData {
  add<const B extends readonly BandInput[]>(...bands: B & ValidateBands<Ids, B>): Diagram<Ids | DeclaredIds<B>>;
  /** `d.connect(a, b, opts)` = `d.add(connect(a, b, opts))`, with the diagram's connectDefaults filled in. */
  connect<const F extends string, const T extends string>(from: RefIn<Ids, F>, to: RefIn<Ids, T>, opts?: ConnectInput): Diagram<Ids>;
}
export type BandInput = Band | Band[];

// ============================================================================================
// DSL input + band: caption / box / banner
// ============================================================================================

// ============================================================================================
// Rich text: a run of words with some of them bold / in a tone (lib/rich.ts builds the parts, richOf() flattens them)
// ============================================================================================

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
  /** An SVG pictogram at the box's left edge (32px); the text is indented to clear it. Not with `step`. Put a label beside it: the icon alone is hidden from screen readers. */
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
}

export interface StatOpts extends Pick<BoxChrome, 'id' | 'flex' | 'width' | 'col' | 'span' | 'reveal' | 'until'> {
  /** The value's text colour; 'solid' / 'solid-danger' instead fill the whole box (white text) as in box({tone}). */
  tone?: TextTone | 'solid' | 'solid-danger';
  size?: 'stat' | 'display';
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

// ============================================================================================
// DSL input + band: group / legend / spacer / raw
// ============================================================================================

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

// ============================================================================================
// DSL input + band: row / grid / connect / pyramid / curve
// ============================================================================================

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
export interface GridBand {
  type: 'grid';
  children: BoxBand[];
  cols: number;
  gap: number;
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
  reveal?: number;
  until?: number;
}
/** branch() target: connect() options plus the target ref. */
export interface BranchTarget extends ConnectOpts {to: string}

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

// ============================================================================================
// DSL input + band: people (N person icons, k emphasized) and dots (dots along a lane)
// ============================================================================================

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

// ============================================================================================
// DSL input + band: plane (a coordinate plane)
// ============================================================================================

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
  tone?: PlaneTone;
  shape?: 'dot' | 'ring' | 'cross';
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
export interface PlaneLabel {at: PlanePos; text: string; anchor?: 'start' | 'middle' | 'end'; tone?: PlaneTone; bold?: boolean; reveal?: number}
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
  /** y grows downward from the top-left origin (image / pixel coordinates). */
  yDown?: boolean;
  /** Light grid lines at the ticks. */
  grid?: boolean;
}
export interface PlaneBand extends PlaneOpts {
  type: 'plane';
  height: number;
}

// ============================================================================================
// DSL input + band: bars
// ============================================================================================

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
}
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

// ============================================================================================
// DSL input + band: timeline
// ============================================================================================

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

// ============================================================================================
// DSL input + band: tree (org chart / hierarchy)
// ============================================================================================

export interface TreeItem {
  label: string;
  /** A second, muted line (a title, a headcount). */
  sub?: string;
  /** Makes the node an anchor: connect() can start or end there. */
  id?: string;
  tone?: BoxTone;
  children?: TreeItem[];
}
export interface TreeOpts extends RevealOpts {
  /** 'down' (default): levels run top to bottom. 'right': left to right, which fits more siblings in a narrow figure. */
  dir?: 'down' | 'right';
  /** The widest a node grows before its text wraps (default 200px). */
  maxNodeW?: number;
  /** A spotlight target and a connect() endpoint (the whole figure). */
  id?: string;
}
export interface TreeBand extends TreeOpts {
  type: 'tree';
  root: TreeItem;
  /** mindmap(): the root in the middle, children split to both sides (the same band, laid out by layoutBalanced). */
  balanced?: boolean;
  /** mindmap(): the side of a root child, by its id (the rest are balanced by height). */
  sides?: Record<string, 'left' | 'right'>;
  /** mindmap(): how the branches are laid out (default 'radial'). */
  layout?: MindmapLayout;
  /** mindmap(): how a branch's line is drawn (tree-like layouts: radial / right / left / down / up). */
  edges?: 'elbow' | 'curve' | 'straight';
}
/**
 * radial: the root in the middle, branches to both sides | right / left: one side only (a logic chart) | down / up: a tree |
 * org: the root's children side by side, each with a list below | list: an outline, indented | brace: a brace map |
 * fishbone: cause and effect, the root is the head | timeline: children along an axis, alternately above and below.
 */
export type MindmapLayout = 'radial' | 'right' | 'left' | 'down' | 'up' | 'org' | 'list' | 'brace' | 'fishbone' | 'timeline';
export interface MindmapOpts extends RevealOpts {
  /** How the branches are laid out (default 'radial'): see MindmapLayout. */
  layout?: MindmapLayout;
  /** How a branch's line is drawn: 'elbow' (default), 'curve' or 'straight'. For radial / right / left / down / up. */
  edges?: 'elbow' | 'curve' | 'straight';
  /** Pin a child of the root (by its id) to a side; the others are balanced by height. */
  sides?: Record<string, 'left' | 'right'>;
  maxNodeW?: number;
  id?: string;
}

// ============================================================================================
// DSL input + band: states (state diagram)
// ============================================================================================

export interface StateItem {
  /** Required: the state is an anchor, and transitions name it. */
  id: string;
  label: string;
  /** A second, muted line (an entry action, a note). */
  sub?: string;
  tone?: BoxTone;
  /** An end state: drawn with a double outline. */
  final?: boolean;
}
export interface Transition {
  from: string;
  to: string;
  /** The event / condition, on the arrow (a state may go to itself). */
  label?: string;
  line?: 'solid' | 'dashed' | 'dotted';
}
export interface StatesOpts extends RevealOpts {
  /** 'right' (default): the flow runs left to right. 'down': top to bottom. */
  dir?: 'right' | 'down';
  /** The state that starts: a filled dot with an arrow into it. */
  initial?: string;
  maxNodeW?: number;
  id?: string;
}
export interface StatesBand extends StatesOpts {
  type: 'states';
  states: StateItem[];
  transitions: Transition[];
}

// ============================================================================================
// DSL input + band: gantt (a schedule)
// ============================================================================================

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
export interface GanttOpts extends RevealOpts {
  /** The axis (default: the first start to the last end). 'YYYY-MM-DD'. */
  from?: string;
  to?: string;
  /** Today, always written out (a build never reads the clock). A line through the chart. */
  today?: string;
  todayLabel?: string;
  id?: string;
}
export interface GanttBand extends GanttOpts {
  type: 'gantt';
  rows: GanttRow[];
}

// ============================================================================================
// DSL input + band: classes (UML class diagram)
// ============================================================================================

export interface ClassItem {
  id: string;
  /** Shown name (default: the id). */
  name?: string;
  /** «interface», «enum» ... above the name. */
  stereotype?: string;
  /** Shorthand for the stereotype «abstract». */
  abstract?: boolean;
  /** One line each: '- id: number'. */
  attrs?: string[];
  methods?: string[];
  tone?: BoxTone;
}
export type RelationKind = 'assoc' | 'arrow' | 'inherit' | 'implement' | 'compose' | 'aggregate' | 'depend';
export interface ClassRelation {
  from: string;
  to: string;
  /** 'assoc' a plain line (default) | 'arrow' directed association | 'inherit' from child to parent (hollow triangle at the parent) |
   *  'implement' dashed, triangle at the interface | 'compose' / 'aggregate' diamond (filled / hollow) on `from`, the whole | 'depend' dashed open arrow. */
  kind?: RelationKind;
  label?: string;
  /** Multiplicity near each end ('1', '0..*'). */
  fromMult?: string;
  toMult?: string;
}
export interface ClassesOpts extends RevealOpts {
  /** 'down' (default): parents on top. 'right': left to right. */
  dir?: 'down' | 'right';
  id?: string;
}
export interface ClassesBand extends ClassesOpts {
  type: 'classes';
  classes: ClassItem[];
  relations: ClassRelation[];
}

// ============================================================================================
// DSL input + band: bpmn (a process in lanes)
// ============================================================================================

export type BpmnNodeKind = 'task' | 'start' | 'end' | 'xor' | 'and' | 'or';
export interface BpmnLane {id: string; label: string; tone?: BoxTone}
export interface BpmnNode {
  id: string;
  lane: string;
  /** A task needs one; an event or gateway may have one (drawn under the shape). */
  label?: string;
  /** A task's second, muted line. */
  sub?: string;
  /** 'task' (default) | 'start' / 'end' event | 'xor' exclusive, 'and' parallel, 'or' inclusive gateway. */
  kind?: BpmnNodeKind;
  tone?: BoxTone;
}
export interface BpmnFlow {
  from: string;
  to: string;
  /** A condition on a flow out of a gateway ('承認'). */
  label?: string;
  /** 'dashed': a message flow between lanes (default: a sequence flow, solid). */
  line?: 'solid' | 'dashed';
}
export interface BpmnOpts extends RevealOpts {id?: string}
export interface BpmnBand extends BpmnOpts {
  type: 'bpmn';
  lanes: BpmnLane[];
  nodes: BpmnNode[];
  flows: BpmnFlow[];
}

// ============================================================================================
// DSL input + band: image
// ============================================================================================

/** A position as fractions of the picture: [0, 0] is its top-left corner, [1, 1] its bottom-right. */
export type ImagePoint = readonly [x: number, y: number];
/** A region as fractions of the picture: [x, y, w, h]. */
export type ImageRect = readonly [x: number, y: number, w: number, h: number];
/** An outline round a region of the picture. Its `id` is a spotlight target and a connect() endpoint. */
export interface ImageMark {
  /** Unique across the diagram, like every anchor id. */
  id?: string;
  rect: ImageRect;
  /** The outline's colour (and the label plate's tone). Default 'accent'. */
  tone?: EmphasisTone;
  /** A word on a plate at the outline's top-left corner. */
  label?: string;
  /** The label's text size (a role: 'note' 14px, 'banner' 16px, 'stat' 34px). Default: the picture's `labelRole`. The plate grows with it. */
  role?: LabelRole;
  /** Never earlier than the picture's own reveal (the later of the two); `until` likewise never later than the picture's. */
  reveal?: number;
  until?: number;
}
/** A word on an opaque plate at a point of the picture. There is no way to put text on the bare picture: its pixels are not known to the contrast check. */
export interface ImageLabel {
  text: string;
  at: ImagePoint;
  /** Which end of the plate sits on `at`. Default 'start'. */
  anchor?: 'start' | 'middle' | 'end';
  /** The plate's tone (its fill, outline and text). Default 'plain' (white plate, dark text). */
  tone?: EmphasisTone;
  /** The text size (a role: 'note' 14px, 'banner' 16px, 'stat' 34px). Default: the picture's `labelRole`. The plate grows with it. */
  role?: LabelRole;
  reveal?: number;
  until?: number;
}
export interface ImageOpts extends RevealOpts {
  /** A spotlight target and a connect() endpoint (the whole picture). May not repeat a mark's id. */
  id?: string;
  /** What the picture shows, for readers who cannot see it (the SVG's <desc> and the <image>'s label). Required: pass `decorative: true` instead when it adds nothing. */
  alt?: string;
  decorative?: boolean;
  /** The picture's width in px (at most the content width; default: the content width). Its height follows the file's aspect ratio. Not together with `height`. */
  width?: number;
  /** The picture's height in px (the width follows the aspect ratio, and is capped at the content width). Not together with `width`. */
  height?: number;
  /** Where a picture narrower than the content sits. Default 'center'. */
  align?: 'left' | 'center' | 'right';
  /** The text size of every label plate that has no `role` of its own. Default 'note' (14px). */
  labelRole?: LabelRole;
  marks?: readonly ImageMark[];
  labels?: readonly ImageLabel[];
  /**
   * Parts laid over the picture, stacked from its top like the children of a group(): the picture is their backdrop. Their text must
   * be checkable: a box / banner is (opaque), a caption or a group title is bare text on the picture and fails the post-render lint.
   * connect() stays a top-level band; it may point at their ids. They must fit in the picture's height (verify says by how much they do not).
   */
  over?: Band | readonly Band[];
  /** Space between the picture's edge and `over` (default 16). */
  pad?: number;
}
export interface ImageBand {
  type: 'image';
  id?: string;
  /** The file as a `data:` URI (read once, by image()). */
  href: string;
  naturalW: number;
  naturalH: number;
  bytes: number;
  alt: string;
  width?: number;
  height?: number;
  align?: 'left' | 'center' | 'right';
  labelRole?: LabelRole;
  marks?: ImageMark[];
  labels?: ImageLabel[];
  /** The `over` parts (named like a group's so the walkers that follow `children` see them). */
  children?: Band[];
  pad?: number;
  reveal?: number;
  until?: number;
}
/** A mark placed (px); `dim` is set by spotlight. */
export interface LaidOutImageMark extends Rect, Dimmed {id?: string; tone: EmphasisTone; reveal?: number; until?: number}
/** A label plate placed (px). `mark`: index of the mark it belongs to. */
export interface LaidOutImagePlate extends Rect, Dimmed {text: string; size: number; tone: EmphasisTone; reveal?: number; until?: number; mark?: number}
export interface LaidOutImage extends Rect, Dimmed {
  type: 'image';
  id?: string;
  href: string;
  alt: string;
  bytes: number;
  reveal?: number;
  until?: number;
  marks: LaidOutImageMark[];
  plates: LaidOutImagePlate[];
  anchors: Anchor[];
  /** Parts are laid over this picture: it is their backdrop, so the overlap and connector checks leave it out. */
  backdrop?: boolean;
  /** Set by spotlight: regions of the picture that stay clear while the rest is veiled (a focused mark). */
  holes?: Rect[];
}

// ============================================================================================
// DSL input + band: sequence
// ============================================================================================

export interface SequenceActor {id: string; label: string; tone?: BoxTone}

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

// ============================================================================================
// DSL input + band: table
// ============================================================================================

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
  /** Draws the symbol + a default tone before `text` (an explicit `tone` / `bold` wins); without `text` the cell is the symbol alone. */
  mark?: CellMark;
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
}
/** cellOf(): a cell with column defaults applied. */
export interface ResolvedCell {text: string; tone?: TextTone; bold: boolean; mono: boolean; align: Align}

// ============================================================================================
// DSL input + band: swimlane
// ============================================================================================

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
export interface SwimlaneOpts extends RevealOpts {
  flows?: SwimlaneFlow[];
  phases?: SwimlanePhase[];
  /** Width of the lane-label column (default 128). */
  labelW?: number;
  colGap?: number;
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
  id?: string;
  reveal?: number;
  until?: number;
}

// ============================================================================================
// DSL input + band: wireframe / screens / stateMatrix  (the wf.* node tree is further below)
// ============================================================================================

export type WfFrame = 'screen' | 'light' | 'none';
/** A wireframe root: one node or several (laid out top to bottom). */
export type WfRoot = WfNode | WfNode[];
export type WfNote = string | {title?: string; text?: string; n?: number};
/** Legend labels for the new / changed outlines. */
export interface WfMarks {new?: string; changed?: string}

/** Fields shared by wireframe() and every screens() item. */
export interface WfScreen {
  title?: string;
  /** '新規' | '改修' | any text, drawn as a pill after the title. */
  tag?: string;
  tagTone?: WfTone;
  root: WfRoot;
  /** wf.dialog / wf.toast, drawn over the screen. One or several. */
  overlays?: WfOverlay | WfOverlay[];
  /** Screen height (default 440 / 320); 'fit' = as tall as the content. */
  h?: number | 'fit';
  frame?: WfFrame;
  /** Text becomes grey bars. */
  skeleton?: boolean;
  /** The diagram's wireframeDefaults shell: `false` leaves this screen without it; an object gives it its per-screen props (see WireframeDefaults). */
  shell?: false | WfShellProps;
}
/** Per-screen input of the diagram's shell: which nav item is selected, a different title, anything a custom `shell` function reads. */
export interface WfShellProps {
  /** appbar shell: the selected nav item, by label or by index. */
  active?: string | number;
  /** appbar shell: replaces the appbar's title for this screen. */
  title?: string;
  [key: string]: unknown;
}
/** diagram({wireframeDefaults}): what every wireframe() / screens() item starts from. A field set on the screen wins. */
export interface WireframeDefaults {
  /** The app's top bar, put above every screen's content: `{title, nav, right}` as wf.appbar(); a screen's `shell: {active}` selects the nav item. */
  appbar?: {title: string; nav?: string[]; right?: string[]};
  /** The general form: wraps each screen's content (any structure). Runs after / instead of `appbar`. */
  shell?: (content: WfNode[], props: WfShellProps) => WfRoot;
  h?: number | 'fit';
  frame?: WfFrame;
  skeleton?: boolean;
  tag?: string;
  tagTone?: WfTone;
}

export interface WireframeOpts extends Omit<WfScreen, 'root'> {
  id?: string;
  notes?: WfNote[];
  noteW?: number;
  marks?: WfMarks;
}
export interface WireframeBand extends WireframeOpts {
  type: 'wireframe';
  root: WfRoot;
}

export interface ScreensItem extends WfScreen {
  /** Makes the screen a connect() anchor. */
  id?: string;
  /** [row, col]; col may be fractional (0.5 = half a column in). */
  at?: [number, number];
}
export interface ScreensOpts {
  /** Columns (default 3, or derived from `at`). */
  cols?: number;
  gap?: number;
  rowGap?: number;
  /** Default item height (320). */
  h?: number | 'fit';
  skeleton?: boolean;
  marks?: WfMarks;
  id?: string;
}

/** One cell of a state matrix: a node, 'na' / {na: reason} (not applicable), or missing / 'todo' (未設計). */
export type StateMatrixCell = WfNode | 'na' | 'todo' | {na: string} | undefined;
export interface StateMatrixRow {
  label: string;
  note?: string;
  /** Mutated by layout: padded with undefined up to the number of columns. */
  cells: StateMatrixCell[];
}
/** What one state of a stateRow() holds: the options that differ from the part's base, a bare WfState, or one of the plain cell forms. */
export type StateCellIn<O> = Partial<O> | WfState | 'na' | 'todo' | {na: string} | undefined;
/** stateRow() result: one part drawn once per state. `K` = the state columns it covers (carried only by the type). */
export interface PartRow<K extends string = string, L extends string = string> {
  type: 'part-row';
  label: string;
  note?: string;
  /** Cells for these columns, in order. Throws on a state that is not a column. */
  cells(cols: readonly string[]): StateMatrixCell[];
  /** Contravariant: a row covering MORE states than the matrix has columns is fine, one covering fewer is a type error. */
  readonly '~cols'?: (c: K) => void;
  /** The row's label as a literal type, so a type error can name the row. */
  readonly '~label'?: L;
}
export interface StateMatrixOpts {
  /** Columns that must exist (checked by the wf-states-required rule). */
  required?: string[];
  labelW?: number;
  /** Cell height (default: fit the content, min 72). */
  cellH?: number;
  gap?: number;
  /** 'light' (default) | 'none' when the parts already have their own border. */
  cellFrame?: 'light' | 'none';
  marks?: WfMarks;
  skeleton?: boolean;
  id?: string;
}
export interface StateMatrix {
  cols: string[];
  rows: StateMatrixRow[];
  required?: string[];
  labelW?: number;
  cellH?: number;
  gap?: number;
  cellFrame?: 'light' | 'none';
}
/** screens() and stateMatrix() both return this; a state matrix has `matrix` set and no items. */
export interface ScreensBand extends ScreensOpts {
  type: 'screens';
  items: ScreensItem[];
  matrix?: StateMatrix;
}

/** Every band the DSL constructors return. */
export type Band =
  | CaptionBand | BoxBand | BannerBand | GroupBand | LegendBand | SpacerBand | RawBand
  | RowBand | GroupRowBand | GridBand | ConnectBand | PyramidBand | CurveBand | PlaneBand | BarsBand | PeopleBand | DotsBand | TimelineBand | TreeBand | StatesBand | GanttBand | ClassesBand | BpmnBand | ImageBand
  | SequenceBand | TableBand | SwimlaneBand | WireframeBand | ScreensBand;

// ============================================================================================
// Wireframe nodes: wf.*  (discriminated on `t`; narrow with `n.t === 'btn'` or WfNodeOf<'btn'>)
// ============================================================================================

/** Tone of chips, alerts, stats, list items, kv rows ...; 'ok' / 'warn' / 'off' are aliases of accent / danger / muted. */
export type WfTone = 'plain' | 'accent' | 'danger' | 'muted' | 'solid' | 'solid-danger' | 'ok' | 'warn' | 'off';
export type WfMark = 'new' | 'changed';
/** Any widget may show one of these states (hatching for visual widgets, a skeleton / message for data widgets). */
export type WfState = 'missing' | 'disconnected' | 'loading' | 'empty' | 'stale';
/** Keys of `parts:` — numbers on a widget's inner pieces (insight / robot / fusion / compare). */
export type WfPartKey =
  | 'level' | 'reference' | 'title' | 'text' | 'evidence'                       // insight
  | 'marker' | 'name' | 'mode' | 'battery' | 'signal' | 'last'                  // robot
  | 'layers' | 'controls' | 'opacity'                                           // fusion
  | 'diff' | 'labels' | 'divider' | 'sync';                                     // compare
/** `true` = auto-number me (wireframe() assigns the next free number in reading order). */
export type WfParts = Partial<Record<WfPartKey, number | true>>;

/** Accepted by every node. */
export interface WfCommon {
  /** Callout number; `true` = number me automatically (wireframe() only). */
  n?: number | true;
  mark?: WfMark;
  /** row child: share of the leftover width; col child: share of the leftover height. */
  flex?: number;
  /** row child: fixed width px. */
  w?: number;
  /** Fixed height px. */
  h?: number;
  /** Minimum natural height of a visual widget (map / chart / ... default 80, chart 100). */
  min?: number;
  state?: WfState;
  /** Replaces the state's default title. */
  stateTitle?: string;
  stateNote?: string;
  parts?: WfParts;
}

/** What wf.* constructors accept as children: nodes, nested arrays of nodes, and falsy values (dropped). */
export type WfChildren = WfNode | null | undefined | false | WfChildren[];

// ---- containers ----
export interface WfColOpts extends WfCommon {pad?: number; gap?: number}
export interface WfRowOpts extends WfCommon {pad?: number; gap?: number; align?: 'center'}
export interface WfCardOpts extends WfCommon {pad?: number; gap?: number; title?: string; tone?: 'muted' | 'plain'}
export interface WfCol extends WfColOpts {t: 'col'; children: WfNode[]}
export interface WfRow extends WfRowOpts {t: 'row'; children: WfNode[]}
export interface WfCard extends WfCardOpts {t: 'card'; children: WfNode[]}

// ---- leaf widgets ----
export type WfSpacerOpts = WfCommon;
export interface WfSpacer extends WfSpacerOpts {t: 'spacer'}
export interface WfTextOpts extends WfCommon {
  /** 'title' = the 15px bold size. */
  size?: 'title';
  bold?: boolean;
  tone?: WfTone;
  align?: Align;
  /** In a skeleton screen: keep this text instead of turning it into bars. */
  keep?: boolean;
}
export interface WfText extends WfTextOpts {t: 'text'; text: string}
export interface WfBtnOpts extends WfCommon {primary?: boolean; danger?: boolean; full?: boolean}
export interface WfBtn extends WfBtnOpts {t: 'btn'; label: string}
export interface WfInputOpts extends WfCommon {
  /** Filled in: the label is drawn as a value (dark), otherwise as a placeholder (muted). */
  value?: string;
}
export interface WfInput extends WfInputOpts {t: 'input'; label: string}
export type WfSelectOpts = WfInputOpts;
export interface WfSelect extends WfSelectOpts {t: 'select'; label: string}
export interface WfChipOpts extends WfCommon {tone?: WfTone}
export interface WfChip extends WfChipOpts {t: 'chip'; label: string}
export interface WfTabsOpts extends WfCommon {active?: number}
export interface WfTabs extends WfTabsOpts {t: 'tabs'; labels: string[]}
export interface WfAppbarOpts extends WfCommon {nav?: string[]; active?: number; right?: string[]}
export interface WfAppbar extends WfAppbarOpts {t: 'appbar'; title: string}
export interface WfSeekOpts extends WfCommon {from?: string; to?: string; /** 0..1 */ at?: number; /** 0..1 each */ marks?: number[]}
export interface WfSeek extends WfSeekOpts {t: 'seek'}
export type WfKvPair = readonly [key: string, value: string | number] | {k: string; v: string | number; tone?: WfTone; bold?: boolean};
export interface WfKvOpts extends WfCommon {keyW?: number}
export interface WfKv extends WfKvOpts {t: 'kv'; pairs: WfKvPair[]}
export interface WfStatOpts extends WfCommon {tone?: WfTone}
export interface WfStat extends WfStatOpts {t: 'stat'; value: string; label: string}
export interface WfListItemSpec {text: string; active?: boolean; badge?: string; tone?: WfTone; keep?: boolean}
export interface WfListOpts extends WfCommon {title?: string}
export interface WfList extends WfListOpts {t: 'list'; items: (string | WfListItemSpec)[]}
export interface WfTableCellSpec {text?: string | number; badge?: string; tone?: WfTone; bold?: boolean; keep?: boolean}
export type WfTableCell = string | number | WfTableCellSpec;
export interface WfTableColumnSpec {label: string; flex?: number}
export type WfTableOpts = WfCommon;
export interface WfTable extends WfTableOpts {t: 'table'; columns: (string | WfTableColumnSpec)[]; rows: WfTableCell[][]}
export interface WfAlertOpts extends WfCommon {tone?: WfTone}
export interface WfAlert extends WfAlertOpts {t: 'alert'; text: string}

// ---- visual widgets (they grow to fill the leftover height) ----
export interface WfChipSpec {text: string; tone?: WfTone}
/** overlay chips (top-left / top-right), label (bottom-left), stamp (bottom-right) shared by visual widgets. */
export interface WfFrameDecor {
  overlay?: (string | WfChipSpec)[];
  overlayRight?: (string | WfChipSpec)[];
  label?: string;
  stamp?: string;
}
export type WfMarkerKind = 'robot' | 'equip' | 'alert' | 'site';
export type WfMarkerShape = 'circle' | 'square' | 'triangle';
export interface WfMapMarker {
  /** Position on the plan, 0..1. */
  x: number;
  y: number;
  kind?: WfMarkerKind;
  /** Letter drawn in a robot marker (a robot is told apart by shape + letter, never colour alone). */
  id?: string;
  shape?: WfMarkerShape;
  /** Degrees, 0 = up, clockwise. */
  heading?: number;
  /** Field of view in degrees. */
  fov?: number;
  fovR?: number;
  /** A number drawn inside the dot (route points). */
  inside?: string | number;
  label?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  tone?: WfTone;
  n?: number | true;
}
export interface WfMapLegendItem {kind: WfMarkerKind; label: string}
export interface WfMapOpts extends WfCommon, WfFrameDecor {
  /** 'floor' (default) | 'site'; anything else draws no plan. */
  plan?: 'floor' | 'site' | 'none';
  /** Polyline in plan coordinates (0..1). */
  route?: [number, number][];
  markers?: WfMapMarker[];
  legend?: WfMapLegendItem[];
}
export interface WfMap extends WfMapOpts {t: 'map'}
export interface WfVideoOpts extends WfCommon, WfFrameDecor {live?: boolean}
export interface WfVideo extends WfVideoOpts {t: 'video'}
export interface WfHeatOpts extends WfCommon, WfFrameDecor {
  probe?: {x?: number; y?: number; value?: string};
  /** Label of the hottest point (falls back to probe.value). */
  max?: string;
  /** [min, max] of the numeric colour scale. */
  scale?: [number, number];
  unit?: string;
}
export interface WfHeat extends WfHeatOpts {t: 'heat'}
export interface WfPointcloudOpts extends WfCommon, WfFrameDecor {}
export interface WfPointcloud extends WfPointcloudOpts {t: 'pointcloud'}
export interface WfChartOpts extends WfCommon, WfFrameDecor {
  kind?: 'line' | 'bar';
  /** Values 0..1. */
  points?: number[];
  threshold?: number;
  thresholdLabel?: string;
  /** Index of the point drawn as an alert. */
  alertAt?: number;
  xLabels?: string[];
}
export interface WfChart extends WfChartOpts {t: 'chart'}
export interface WfImageOpts extends WfCommon, WfFrameDecor {}
export interface WfImage extends WfImageOpts {t: 'image'; label: string}

// ---- wireframe-parts.ts ----
export interface WfFusionLayerSpec {
  label: string;
  /** Default: guessed from the label (点群 = cloud, 赤外 / 熱 = thermal, else camera). */
  kind?: 'camera' | 'cloud' | 'thermal';
  /** A layer that cannot be switched on (its data is missing). */
  state?: WfState;
  on?: boolean;
}
export interface WfFusionOpts extends WfCommon, WfFrameDecor {
  /** Default ['カメラ', '点群', '赤外線']. */
  layers?: (string | WfFusionLayerSpec)[];
  /** 0..1 (default 0.6); false hides the opacity slider. */
  opacity?: number | false;
  /** false hides the whole layer-toggle strip. */
  controls?: boolean;
  /** Label of the hottest spot. */
  hot?: string;
}
export interface WfFusion extends WfFusionOpts {t: 'fusion'}
export interface WfCompareOpts extends WfCommon, WfFrameDecor {
  left?: string;
  right?: string;
  /** Divider position 0..1 (default 0.5). */
  at?: number;
  /** Diff boxes in frame coordinates 0..1. */
  diff?: {x: number; y: number; w: number; h: number}[];
  /** true or the label of the "playback is synchronised" pill. */
  sync?: boolean | string;
  kind?: 'map' | 'camera';
}
export interface WfCompare extends WfCompareOpts {t: 'compare'}
export interface WfRegionOpts extends WfCommon {
  emphasis?: 'primary' | 'normal';
  hint?: string;
  dashed?: boolean;
}
export interface WfRegion extends WfRegionOpts {t: 'region'; label: string}
export interface WfRobotOpts extends WfCommon {
  name: string;
  mode?: string;
  modeTone?: WfTone;
  /** 0..1. */
  battery?: number;
  /** 0 (lost) .. 3. */
  link?: 0 | 1 | 2 | 3;
  /** Last received time text. */
  last?: string;
  active?: boolean;
  marker?: {shape?: WfMarkerShape; id?: string};
  /** Stack the rows (default: when narrower than 210px). */
  compact?: boolean;
}
export interface WfRobot extends WfRobotOpts {t: 'robot'}
export interface WfBatteryOpts extends WfCommon {}
export interface WfBattery extends WfBatteryOpts {t: 'battery'; /** 0..1 */ level: number}
export interface WfSignalOpts extends WfCommon {
  /** Replaces the default words (途絶 / 弱い / やや弱い / 良好). */
  text?: string;
}
export interface WfSignal extends WfSignalOpts {t: 'signal'; /** 0..3 */ level?: number}
export interface WfEvidence {kind: string; /** acquisition time */ at: string}
export interface WfInsightOpts extends WfCommon {
  title: string;
  level?: 'danger' | 'warn' | 'info';
  text?: string;
  /** Required: an insight shows the data it rests on and when it was taken. */
  evidence: WfEvidence[];
  /** Replaces the level's default badge text. */
  badge?: string;
  /** false hides the 参考表示 chip. */
  reference?: boolean;
}
export interface WfInsight extends WfInsightOpts {t: 'insight'}
export type WfBreadcrumbOpts = WfCommon;
export interface WfBreadcrumb extends WfBreadcrumbOpts {t: 'breadcrumb'; items: string[]}
export interface WfToggleOpts extends WfCommon {on?: boolean}
export interface WfToggle extends WfToggleOpts {t: 'toggle'; label: string}
export interface WfCheckboxOpts extends WfCommon {checked?: boolean}
export interface WfCheckbox extends WfCheckboxOpts {t: 'checkbox'; label: string}
export interface WfRadioOpts extends WfCommon {selected?: boolean}
export interface WfRadio extends WfRadioOpts {t: 'radio'; label: string}
export interface WfSliderOpts extends WfCommon {/** 0..1 */ value?: number; display?: string}
export interface WfSlider extends WfSliderOpts {t: 'slider'; label: string}

// ---- overlays (wireframe({overlays}) / a screens() item's `overlays`) ----
export interface WfDialogOpts extends WfCommon {body?: string; buttons?: WfBtn[]}
export interface WfDialog extends WfDialogOpts {t: 'dialog'; title: string}
export interface WfToastOpts extends WfCommon {tone?: WfTone}
export interface WfToast extends WfToastOpts {t: 'toast'; text: string}
export type WfOverlay = WfDialog | WfToast;

/** Every wf.* node (overlays included: place() / drawOverlay() treat them as nodes). */
export type WfNode =
  | WfCol | WfRow | WfCard | WfSpacer | WfText | WfBtn | WfInput | WfSelect | WfChip | WfTabs | WfAppbar | WfSeek
  | WfKv | WfStat | WfList | WfTable | WfAlert
  | WfMap | WfVideo | WfHeat | WfPointcloud | WfChart | WfImage
  | WfFusion | WfCompare | WfRegion | WfRobot | WfBattery | WfSignal | WfInsight | WfBreadcrumb
  | WfToggle | WfCheckbox | WfRadio | WfSlider
  | WfDialog | WfToast;
export type WfType = WfNode['t'];
/** The node type for a given `t`: WfNodeOf<'btn'> = WfBtn. */
export type WfNodeOf<K extends WfType> = Extract<WfNode, {t: K}>;
/** Nodes that hold children. */
export type WfContainer = WfCol | WfRow | WfCard;

/** The `wf` namespace object: node constructors. Built in wireframe.ts, extended by wireframe-parts.ts. */
export interface Wf {
  col(children: WfChildren, opts?: WfColOpts): WfCol;
  row(children: WfChildren, opts?: WfRowOpts): WfRow;
  card(children: WfChildren, opts?: WfCardOpts): WfCard;
  spacer(h?: number, opts?: WfSpacerOpts): WfSpacer;
  text(text: string, opts?: WfTextOpts): WfText;
  btn(label: string, opts?: WfBtnOpts): WfBtn;
  input(label: string, opts?: WfInputOpts): WfInput;
  select(label: string, opts?: WfSelectOpts): WfSelect;
  chip(label: string, opts?: WfChipOpts): WfChip;
  tabs(labels: string[], opts?: WfTabsOpts): WfTabs;
  appbar(title: string, opts?: WfAppbarOpts): WfAppbar;
  seek(opts?: WfSeekOpts): WfSeek;
  kv(pairs: WfKvPair[], opts?: WfKvOpts): WfKv;
  stat(value: string | number, label: string, opts?: WfStatOpts): WfStat;
  list(items: (string | WfListItemSpec)[], opts?: WfListOpts): WfList;
  table(columns: (string | WfTableColumnSpec)[], rows: WfTableCell[][], opts?: WfTableOpts): WfTable;
  alert(text: string, opts?: WfAlertOpts): WfAlert;
  map(opts?: WfMapOpts): WfMap;
  video(opts?: WfVideoOpts): WfVideo;
  heat(opts?: WfHeatOpts): WfHeat;
  pointcloud(opts?: WfPointcloudOpts): WfPointcloud;
  chart(opts?: WfChartOpts): WfChart;
  image(label: string, opts?: WfImageOpts): WfImage;
  dialog(title: string, opts?: WfDialogOpts): WfDialog;
  toast(text: string, opts?: WfToastOpts): WfToast;
  // wireframe-parts.ts
  fusion(opts?: WfFusionOpts): WfFusion;
  compare(opts?: WfCompareOpts): WfCompare;
  region(label: string, opts?: WfRegionOpts): WfRegion;
  robot(opts: WfRobotOpts): WfRobot;
  battery(level: number, opts?: WfBatteryOpts): WfBattery;
  signal(level?: number, opts?: WfSignalOpts): WfSignal;
  insight(opts: WfInsightOpts): WfInsight;
  breadcrumb(items: string[], opts?: WfBreadcrumbOpts): WfBreadcrumb;
  toggle(label: string, opts?: WfToggleOpts): WfToggle;
  checkbox(label: string, opts?: WfCheckboxOpts): WfCheckbox;
  radio(label: string, opts?: WfRadioOpts): WfRadio;
  slider(label: string, opts?: WfSliderOpts): WfSlider;
}

// ============================================================================================
// Wireframe drawing primitives (flat, absolute coordinates, token-key colours) and drawing context
// ============================================================================================

export interface PrimRect {
  k: 'rect'; x: number; y: number; w: number; h: number; r: number;
  fill: ColorKey | null; stroke: ColorKey | null; sw: number; dash?: string; op?: number;
}
export interface PrimCircle {
  k: 'circle'; cx: number; cy: number; r: number;
  fill: ColorKey | null; stroke: ColorKey | null; sw: number; op?: number;
}
export interface PrimPath {
  k: 'path'; d: string;
  fill: ColorKey | null; stroke: ColorKey | null; sw: number; dash?: string; op?: number; cap?: string;
}
export interface PrimText {
  k: 'text'; s: string; x: number;
  /** Baseline. */
  y: number; size: number; weight: number; fill: ColorKey; anchor?: 'middle' | 'end';
}
/** A label inside a shape, drawn as one accessible group (see badge.ts). `w` is the measured width. */
export interface PrimBadge {
  k: 'badge'; cx: number; cy: number; r: number; w: number; shape: 'circle' | 'square' | 'triangle';
  label: string; aria: string; size: number; fill: ColorKey;
}
/** A word in a rounded label (a wireframe chip), drawn as one pill (see badge.ts). `base` is the text baseline. */
export interface PrimPill {
  k: 'pill'; x: number; y: number; w: number; h: number;
  label: string; size: number; base: number; fill: ColorKey; stroke: ColorKey | null; text: ColorKey;
}
export type Prim = PrimRect | PrimCircle | PrimPath | PrimText | PrimBadge | PrimPill;

/** Options of the rect / circle / path / line drawing helpers. `fill` / `stroke` default to null (none). */
export interface DrawShapeOpts {
  r?: number;
  fill?: ColorKey | null;
  stroke?: ColorKey | null;
  /** Stroke width (default 2). */
  sw?: number;
  dash?: string;
  /** Opacity. */
  op?: number;
  cap?: string;
}
export interface DrawTextOpts {
  /** Default 14. */
  size?: number;
  /** Default 400. */
  weight?: number;
  /** Default 'text'. */
  fill?: ColorKey;
  anchor?: 'middle' | 'end';
}
/** A numbered callout waiting to be drawn / already drawn (`n` is a number once wireframe() has auto-numbered). */
export interface WfCallout {n: number; x: number; y: number}

/** Mutable state of one wireframe()/screens() layout pass. */
export interface WfCtx {
  widthOf: WidthOf;
  skeleton: boolean;
  /** Reassigned (not just pushed to) by hideUnder(). */
  prims: Prim[];
  /** Callouts queued by the current screen; flushed (drawn) after each screen. */
  callouts: WfCallout[];
  /** Every callout drawn so far (kept on the laid-out band for the wf-callout-order rule). */
  all: WfCallout[];
  /** Which marks ('new' / 'changed') were used, for the marks legend. */
  used: Set<WfMark>;
}
export interface WfSize {w: number; h: number}
export type WfDrawFn<N extends WfNode = WfNode> = (n: N, x: number, y: number, w: number, h: number, ctx: WfCtx) => WfSize;
export type WfNatFn<N extends WfNode = WfNode> = (n: N, w: number, ctx: WfCtx) => number;
export type WfAutoWFn<N extends WfNode = WfNode> = (n: N, ctx: WfCtx) => number;
/** Draw / natural-height / natural-width tables, filled by wireframe.ts and wireframe-parts.ts. */
export type WfDrawTable = {[K in WfType]?: WfDrawFn<WfNodeOf<K>>};
export type WfNatTable = {[K in WfType]?: WfNatFn<WfNodeOf<K>>};
export type WfAutoWTable = {[K in WfType]?: WfAutoWFn<WfNodeOf<K>>};

/** The drawing helpers wireframe.ts hands to wireframe-parts.ts installParts(). */
export interface WfHelpers {
  wf: Wf;
  DRAW: WfDrawTable;
  NAT: WfNatTable;
  AUTO_W: WfAutoWTable;
  /** 14 / 15: body and title font sizes. */
  S: number;
  T: number;
  /** Line height of a font size. */
  lh(size: number): number;
  rect(ctx: WfCtx, x: number, y: number, w: number, h: number, o?: DrawShapeOpts): void;
  circle(ctx: WfCtx, cx: number, cy: number, r: number, o?: DrawShapeOpts): void;
  /** A label inside a shape, as one accessible group; returns its bounding box (see badge.ts). */
  badge(ctx: WfCtx, cx: number, cy: number, label: string | number, o?: BadgeOpts): BadgeBox;
  text(ctx: WfCtx, s: string | number, x: number, base: number, o?: DrawTextOpts): void;
  path(ctx: WfCtx, d: string, o?: DrawShapeOpts): void;
  line(ctx: WfCtx, x1: number, y1: number, x2: number, y2: number, o?: DrawShapeOpts): void;
  /** Polyline path data from points. */
  pts(ps: [number, number][]): string;
  /** Baseline that centres text on cy. */
  mid(cy: number, size?: number): number;
  /** Text width. */
  tw(ctx: WfCtx, s: string | number, size: number, weight: number): number;
  wrapT(ctx: WfCtx, s: string | number, size: number, weight: number, maxW: number): string[];
  drawChip(ctx: WfCtx, label: string, x: number, y: number, tone?: WfTone): number;
  chipW(ctx: WfCtx, label: string): number;
  hideUnder(ctx: WfCtx, X: number, Y: number, W: number, H: number): void;
}
export interface BadgeOpts {shape?: 'circle' | 'square' | 'triangle'; r?: number; fill?: ColorKey; aria?: string}
export interface GlyphOpts {shape?: WfMarkerShape; id?: string; r?: number; fill?: ColorKey}
/** What installParts() returns to wireframe.ts. */
export interface WfPartsApi {
  drawState(n: WfNode, x: number, y: number, w: number, h: number, ctx: WfCtx): void;
  /** Height a widget needs for its state's message box to fit (0: no extra need). */
  stateMinH(n: WfNode, w: number, ctx: WfCtx): number;
  glyph(ctx: WfCtx, cx: number, cy: number, o?: GlyphOpts): void;
  fovSector(ctx: WfCtx, px: number, py: number, deg: number, fov: number, R: number): void;
  headingArrow(ctx: WfCtx, px: number, py: number, deg: number, r: number): void;
  /** Strings a node may draw that are not literally in the tree (so they are measured up front). */
  strings(n: WfNode): string[];
  always: string[];
}

// ============================================================================================
// Measuring / wrapping
// ============================================================================================

/** Width of one break atom at (size, weight, font), from the batched measurement. */
export type WidthOf = (atom: string, size: number, weight: number, font: FontFamily) => number;
export interface MeasureRequest {text: string; size: number; weight?: number; font?: FontFamily}
export interface Measured {w: number; h: number}
/** [text, size, weight, font]: what collectTextRequests() reports for one string. */
export type TextRequest = [text: string, size: number, weight: number, font: FontFamily];
export interface WrapOptions {maxWidth: number; atomWidth: (atom: string) => number}

// ============================================================================================
// Laid-out bands (layout.ts output; `laidOut` of a LaidOutDiagram)
// ============================================================================================

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
}
/** A text run after wrapping: `lines[i]` is drawn with its baseline at band.y + padY + lineYs[i]. */
export interface WrappedRun extends TextRun {
  lines: string[];
  lineYs: number[];
  /** Per line, the pieces of `lines[i]` (only when the run has spans). */
  lineSpans?: Span[][];
}

export interface LaidOutCaption extends CaptionBand, Rect, Dimmed {
  wrappedRuns: WrappedRun[];
  tagBox?: Rect;
  /** group() titles only: the rect the title's text really covers (the caption itself spans the whole frame width). */
  inkBox?: Rect;
}
export interface LaidOutBox extends BoxBand, Rect, Dimmed {wrappedRuns: WrappedRun[]; tagBox?: Rect; stampW?: number; nowrapOverflow?: string[]}
export interface LaidOutBanner extends BannerBand, Rect, Dimmed {wrappedRuns: WrappedRun[]; tagBox?: Rect; stampW?: number}
/** The frame of a group; its children are laid out as separate bands after it. */
export interface LaidOutGroup extends Rect, Dimmed {type: 'group'; tone: BoxTone; dashed?: boolean; frame?: false; stamp?: string; stampW?: number; id?: string; reveal?: number}
export interface LaidOutLegendItem extends LegendItem {textW: number; w: number; x: number; y: number}
export interface LaidOutLegend extends Rect {type: 'legend'; items: LaidOutLegendItem[]}
export interface RowArrow {x1: number; y1: number; x2: number; y2: number}
export interface LaidOutRow extends Rect, Dimmed {type: 'row'; id?: string; children: LaidOutBox[]; arrows: RowArrow[]}
/** Grids have no `h` of their own (children carry the geometry). */
export interface LaidOutGrid extends Dimmed {type: 'grid'; x: number; y: number; w: number; children: LaidOutBox[]}
export interface LaidOutRaw extends RawBand, Rect {}
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
  id?: string;
  reveal?: number;
  until?: number;
}
/** A swimlane step as laid out: a box that remembers its lane. */
export interface LaidOutStep extends LaidOutBox {lane: string; row?: number; col: number; span: number}

export interface LaidOutSeqHead extends Rect {id: string; tone?: BoxTone; lines: string[]; cx: number}
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

export interface LaidOutTableCell {text: string; tone?: TextTone; bold: boolean; mono: boolean; align: Align; lines: string[]; x: number; w: number; top: number}
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
}

/** wireframe() as laid out: flat primitives + the callouts drawn (for the order rule). */
export interface LaidOutWireframe extends Rect {
  type: 'wireframe';
  id?: string;
  title?: string;
  prims: Prim[];
  callouts: WfCallout[];
  /** The screen frame, as a connect() anchor (only when the wireframe has an id). */
  anchors: Anchor[];
}
export interface LaidOutScreens extends Rect {
  type: 'screens';
  id?: string;
  title?: string;
  prims: Prim[];
  /** One per screen with an id (state-matrix cells get none and keep id-less rects: see layout). */
  anchors: Anchor[];
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
  points: {x: number; y: number; tone: PlaneTone; shape: 'dot' | 'ring' | 'cross'; reveal?: number}[];
  lines: (PlaneSeg & {tone: PlaneTone; dashed: boolean; arrow: boolean; reveal?: number})[];
  /** `curves`: one [control 1, control 2, end] per piece of a smooth path (empty for a polyline, which runs through `pts`). `tip`: the unit direction of the arrowhead. `overshoot`: px the curve leaves the plot area. */
  paths?: {pts: {x: number; y: number}[]; curves: {x: number; y: number}[][]; tone: PlaneTone; dashed: boolean; arrow: boolean; tip: {dx: number; dy: number}; reveal?: number; /** `grow` paths: the stage of each piece (one per segment of `pts`). */ segReveal?: number[]; overshoot: number}[];
  dims: {from: Point; to: Point; line: PlaneSeg; ext: PlaneSeg[]; chip: Rect; tone: PlaneTone; reveal?: number}[];
  /** Every label placed, as a rect: verify.ts reports two that overlap, one that leaves the figure, or one on the ink below. `dim`: the dimension line it belongs to. */
  labelBoxes: (Rect & {label: string; dim?: number})[];
  /** The plane's ink a label must stay clear of (axes and their arrowheads, ticks, points, guide and dimension lines). `dim`: the dimension it belongs to (its own label sits on it by design). */
  obstacles: (Rect & {what: string; dim?: number})[];
}

export interface BarRect extends Rect, Dimmed {fill: ColorKey; id?: string; reveal?: number; until?: number}
/** `bar`: index into `bars` of the bar the label belongs to (none for tick labels), so spotlight can dim it with its bar. */
export interface BarText extends Dimmed {text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; fill: ColorKey; size: number; bold?: boolean; reveal?: number; until?: number; bar?: number}
export interface LaidOutBars extends Rect, Dimmed {
  type: 'bars';
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
  stems: {x: number; y1: number; y2: number; tone: 'accent' | 'danger' | 'muted'}[];
  dots: {x: number; y: number; r: number; tone: 'accent' | 'danger' | 'muted'}[];
  texts: TimelineText[];
  labelBoxes: (Rect & {label: string})[];
}

export interface TreeNodeText extends Dimmed {text: string; x: number; y: number; size: number; bold: boolean; muted: boolean}
export interface LaidOutTree extends Rect, Dimmed {
  type: 'tree';
  id?: string;
  reveal?: number;
  until?: number;
  nodes: (Rect & {tone: BoxTone; id?: string})[];
  /** Parent to child, each a polyline (centre line of the box edge to the child's box edge); `curve` draws it as a smooth S, `bold` as a spine. */
  edges: {points: {x: number; y: number}[]; curve?: 'x' | 'y'; bold?: boolean}[];
  /** brace maps: a `{` over the children of one parent. */
  braces?: {x: number; y1: number; y2: number; ymid: number; tipX: number; side: 'right' | 'left'}[];
  texts: TreeNodeText[];
  /** Nodes with an id: what connect() can reach. */
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}

export interface LaidOutStates extends Rect, Dimmed {
  type: 'states';
  id?: string;
  reveal?: number;
  until?: number;
  nodes: (Rect & {tone: BoxTone; final?: boolean})[];
  initial?: {x: number; y: number; r: number};
  /** Orthogonal polylines from the tail state's box edge to the head's; the arrowhead is at the last point. */
  edges: {from: string; to: string; points: {x: number; y: number}[]; line: 'solid' | 'dashed' | 'dotted'}[];
  texts: TreeNodeText[];
  /** Transition labels: a white chip (x, y, w, h) with its text baseline at (tx, ty), in `size` px. */
  labels: (Rect & {text: string; tx: number; ty: number; size: number; /** index of its arrow in `edges` */ edge: number})[];
  anchors: Anchor[];
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

export interface LaidOutClasses extends Rect, Dimmed {
  type: 'classes';
  id?: string;
  reveal?: number;
  until?: number;
  /** `dividers`: the y of the lines between name / attributes / methods. */
  nodes: (Rect & {tone: BoxTone; dividers: number[]})[];
  /** Orthogonal polylines from `from`'s box to `to`'s (the end marks come from `kind`: at the end for inherit / implement / arrow / depend, at the start for compose / aggregate). */
  edges: {from: string; to: string; kind: RelationKind; line: 'solid' | 'dashed'; points: {x: number; y: number}[]}[];
  texts: GanttText[];
  /** Relation labels and multiplicities: a white chip with its text baseline at (tx, ty), in `size` px; `edge` is the index of its relation in `edges`. */
  labels: (Rect & {text: string; tx: number; ty: number; size: number; edge: number})[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}

export interface LaidOutBpmn extends Rect, Dimmed {
  type: 'bpmn';
  id?: string;
  reveal?: number;
  until?: number;
  lanes: (Rect & {labelW: number; tone: BoxTone})[];
  /** The shape of each node (a circle, a diamond or a rounded rectangle). */
  nodes: (Rect & {kind: BpmnNodeKind; tone: BoxTone})[];
  edges: {from: string; to: string; line: 'solid' | 'dashed'; points: {x: number; y: number}[]}[];
  texts: GanttText[];
  /** Flow conditions: a white chip with its text baseline at (tx, ty), in `size` px; `edge` is the index of its flow in `edges`. */
  labels: (Rect & {text: string; tx: number; ty: number; size: number; edge: number})[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}

export type LaidOutBand = (
  | LaidOutCaption | LaidOutBox | LaidOutBanner | LaidOutGroup | LaidOutLegend | LaidOutRow | LaidOutGrid
  | LaidOutRaw | LaidOutPyramid | LaidOutCurve | LaidOutPlane | LaidOutBars | LaidOutImage | LaidOutPeople | LaidOutDots | LaidOutTimeline | LaidOutTree | LaidOutStates | LaidOutGantt | LaidOutClasses | LaidOutBpmn | LaidOutSwimlane | LaidOutSequence | LaidOutTable
  | LaidOutWireframe | LaidOutScreens) & Dimmed;

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

/** layoutDiagram() output: the diagram data plus everything layout computed. */
export interface LaidOutDiagram extends DiagramData {
  laidOut: LaidOutBand[];
  canvasHeight: number;
  /** The height the bands need, before diagram({canvas}) pads the canvas up to its fixed height. */
  contentHeight?: number;
  connects: LaidOutConnect[];
  /** Set by build() when fill: true scaled the fonts. */
  fontScale?: number;
  /** The font sizes the layout was made with; emit reads them from here, so a drawing always agrees with its layout. */
  roles: Roles;
}

// ============================================================================================
// Rules, verification, fit, budget
// ============================================================================================

export type Severity = 'warn' | 'info';
/** One rule result (rules.ts). `rule` is a key of RULE_DOCS. */
export interface Finding {rule: string; severity: Severity; message: string}
/** What the lint rules read: the diagram's bands plus (optionally) layout results. */
export interface LintTarget extends DiagramData {
  laidOut?: LaidOutBand[];
  connects?: LaidOutConnect[];
  contentHeight?: number;
}
/** verifyDiagram() result: `problems` fail the build, `warnings` never do. */
export interface Verdict {
  ok: boolean;
  problems: string[];
  warnings: string[];
  findings: Finding[];
}
/** A checkable rect in verify.ts (id null when the band has none). */
/** `holds`: ids of anchors drawn inside this rect (an image's marks): a connector that starts on one may cross the rect. `backdrop`: a picture with parts over it, not an obstacle or an overlap partner. */
/** `life`: when it is on screen, if not always (a bar that another `replaces` shares its place with it). */
export interface CheckRect extends Rect {id: string | null; label: string; life?: {reveal?: number; until?: number}; holds?: string[]; backdrop?: boolean}

export interface FitReport {
  scale: number;
  effectiveFont: number;
  recommendedMaxHeight: number;
  imgStyle: string;
  bannerHeight: number;
  warnings: string[];
  /** Present (true) only for doc-medium diagrams. */
  doc?: true;
}

export interface BudgetLimits {boxBody: number; total: number; boxes: number}
export interface BudgetMeasure {boxes: number; total: number; maxBody: {width: number; label: string}}

/** getSlideBudget() result. */
export interface SlideBudget {
  maxHeight: number;
  contentWidth: number;
  index: number;
  cached: boolean;
}
/** build() result. */
export interface BuildResult {
  outPath: string;
  /** The .html written beside the SVG (build(..., {html: true})). */
  htmlPath?: string;
  revealPaths: string[];
  width: number;
  height: number;
  fit: FitReport;
  budget: SlideBudget | null;
  fontScale: number | undefined;
  warnings: string[];
  findings: Finding[];
}
/** renderDiagram() result: everything build() knows before it touches the disk. */
export interface RenderResult {
  svg: string;
  /** The HTML/CSS rendering (lib/emit-html.ts); set only when renderDiagram() was asked for it. */
  html?: string;
  laidOut: LaidOutDiagram;
  verdict: Verdict;
  /** Problems that would keep an <img> from loading the SVG as XML (empty when well-formed). */
  xml: string[];
  /** Things the caller should tell the person (a slide budget that was not measured, ...). */
  notes: string[];
  width: number;
  height: number;
  fit: FitReport;
  budget: SlideBudget | null;
  /** Where the slide budget came from; null when the diagram names no slide. */
  budgetSource: 'measured' | 'cache' | 'default' | null;
  fontScale: number | undefined;
}
/** checkDiagram() result. */
export interface CheckResult {laidOut: LaidOutDiagram; verdict: Verdict}

// ============================================================================================
// Project config, svg diff, documents
// ============================================================================================

/** .svg-diagram.json (+ `_file`, the path it was read from). */
export interface Config {
  accept?: Partial<Record<RuleId, string>>;
  maxWidth?: number;
  /** How text is measured: 'font' (default) from the font files, no browser (see `fonts`); 'chromium' in a headless browser. */
  measure?: 'chromium' | 'font';
  /** Font files to measure with when `measure` is 'font': per family, the regular and the bold (weight >= 600) one, as `path` or `path#faceIndex`. Unset: found with fontconfig. */
  fonts?: FontSpecs;
  _file?: string;
}
export type FontSpecs = Partial<Record<FontFamily, {regular?: string; bold?: string}>>;
export interface ChangeExplanation {identical: boolean; visual: boolean; lines: string[]}
/** One numbered item of a Markdown page's notes list. */
export interface DocNoteItem {n: number; title: string; text: string}
/** One `![alt](x.svg)` found in a Markdown page, with the numbered list after it. */
export interface DocImage {line: number; alt: string; ref: string; items: DocNoteItem[]}
