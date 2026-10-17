// Types: Tokens, tones, geometry, the diagram() input and text measuring.
import type {DEFAULT_LEGEND_LABELS, RULE_DOCS} from '../rules.ts';
import type {ConnectInput, DeclaredIds, RefIn, ValidateBands} from '../strict.ts';
import type {ToneOverrides} from '../tokens.ts';
import type {Band} from './index.ts';
import type {BoxTone} from './text-bands.ts';
import type {WireframeDefaults} from './wireframe.ts';

/** Palette keys diagram() accepts: 1 / 2 (the training deck's legacy day numbers) or a named theme. */
export type Theme = 1 | 2 | 'blue' | 'teal' | 'amber';
/** 'light' (default) | 'dark': which token set the diagram is drawn with (tokens.ts DARK_PALETTE). 'auto': drawn light, plus a prefers-color-scheme: dark rule for each colour it uses (lib/appearance-auto.ts). */
export type Appearance = 'light' | 'dark' | 'auto' | {dark: Partial<DarkTokens>};
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
export type ColorKey = PlainColorKey | 'accent' | 'soft' | `#${string}`; // a #rrggbb only comes from a tone override (tokens.ts toneEnv)
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
export interface Point {x: number; y: number}
export interface Rect {x: number; y: number; w: number; h: number}
export interface Dimmed {/** Set on laid-out elements outside diagram({spotlight}). */ dim?: boolean}
/** A named rect connect() can attach to: any band/child with an `id` (boxes, groups, screens, ...). */
export interface Anchor extends Rect {id: string}
/** Result of parsing a connect() ref 'id', 'id:side' or 'id:side@t'. */
export interface ConnectRef {id: string; side: string; at: number}
/** diagram({canvas}): the fixed slide canvas the diagram is drawn on. `minText` is the smallest text size (px, in the canvas's own units) the lint accepts. Below 14 (down to 10) only for a dense figure read 1:1, not projected, and only when the project's `fontFloor` allows it. */
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
  /** Glossary: {'ユーザー': ['利用者', 'ユザー']} — the word to use and the spellings that are reported (`term-avoid`). The project's `terms` apply too. */
  terms?: Readonly<Record<string, readonly string[]>>;
  /** 'auto' adds a legend entry for every notation used but not listed. false: this diagram needs no legend (legend-missing / legend-incomplete are not reported). */
  legend?: 'auto' | false;
  legendLabels?: Partial<Record<NotationKey, string>>;
  /** Replace colours of tones for this diagram: `{accent: {fill: '#e6d3bd', dark: {fill: '#4a3a28'}}}`. Per tone: fill / stroke / text / ink (#rrggbb), and `dark` for the same under appearance 'dark'. Checked like the built-in colours (text-contrast, gray-tone-collision). The project's `tones` apply under it. */
  tones?: ToneOverrides;
  /** Where a long label may break: 'phrase' (default) keeps a katakana run and a kanji run whole ('アプリ' is never ア/プ/リ); 'char' lets any CJK character end a line; 'bunsetsu' also keeps a hiragana with the character before it (breaks only after a hiragana that a non-hiragana follows, or after 、。) and widens tree-like boxes to their longest unit. */
  wrap?: 'phrase' | 'char' | 'bunsetsu';
  /** Never break a katakana word across lines: a box is at least as wide as its longest katakana word (up to the node width the component starts with, at most 240px). Default off: nothing changes for a figure that does not write it. A figure that does not fit with the floor is tried without it (the break is then reported by text-mid-word-break). Also settable for every diagram in `.svg-diagram.json` ("keepWords": true). */
  keepWords?: boolean;
  /** The figure's width in px (default 940). 'fit' narrows it to what the figure shows plus the padding (text sizes do not change; a figure whose content already spans the width stays 940).
   *  For a thin figure (a concentric, a vertical chevron, a few people). It changes the figure's size in the document, so it is never the default. Not with `canvas`, `fill` or `slide`. */
  width?: number | 'fit';
  /** The widest this figure may be before `check` warns `doc-width` (default 940, or the project's `maxWidth`). It does not make the figure wider: that is `width`.
   *  Writing `maxWidth: 1200` alone leaves the width at 940; write `width: 1200` too. Not for `canvas` figures. */
  maxWidth?: number;
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
  /** The state of the whole figure: 'draft' puts a "下書き" badge in a strip at the top (right end) and says so in <desc> / <metadata>. */
  status?: DiagramStatus;
  /** The badge's wording instead of "下書き" (e.g. "仮説", "仮置き"): one non-empty line. Only with `status`. */
  statusLabel?: string;
  /** 'strict': this diagram's `layout-*` findings (alignment and whitespace) are warnings, so `check --strict` fails on them. Default 'info'. A check setting only: it never changes the drawing. */
  layoutCheck?: LayoutCheck;
  /** 'strict': the `toc-*` findings of this diagram's causeTree({tree}) figures are warnings, so `check --strict` fails on them. Default 'info'. A check setting only: it never changes the drawing. */
  tocCheck?: TocCheck;
  /** 'strict': the findings of the cause-analysis figures (`fta-*`, `isisnot-*`, `whywhy-*`, `bowtie-*`: ADR 0025 / 0026) are warnings, so `check --strict` fails on them. Default 'info'. A check setting only: it never changes the drawing. */
  rcaCheck?: RcaCheck;
  /** Turns on the `stat-no-source` check (a stat() number with no `source`): 'info', or 'strict' for warn. Unset: the check does not run. A check setting only: it never changes the drawing. */
  evidenceCheck?: EvidenceCheck;
}
/** diagram({evidenceCheck}): the severity of `stat-no-source`; leave it out to skip the check. */
export type EvidenceCheck = 'info' | 'strict';
/** diagram({tocCheck}): the severity of the `toc-*` findings. */
export type TocCheck = 'info' | 'strict';
/** diagram({rcaCheck}): the severity of the cause-analysis findings (fault tree, IS / IS NOT, why-why, bow-tie). */
export type RcaCheck = 'info' | 'strict';
/** Which cause-analysis figure a table or tree was built by (ADR 0026 D1). */
export type RcaKind = 'isisnot' | 'whywhy-table' | 'whywhy-tree';
/** One finding of a cause-analysis figure, worked out when the figure was built. `severity: 'info'` stays info under diagram({rcaCheck: 'strict'}). */
export interface RcaFinding {rule: 'isisnot-no-isnot' | 'isisnot-no-distinct-at-all' | 'isisnot-no-hypothesis-stands' | 'whywhy-no-root' | 'whywhy-measure-without-root' | 'whywhy-single-chain' | 'whywhy-dig-below-root' | 'bowtie-barrier-missing'; message: string; severity?: 'info'}
/** The `rca` field of a table or cause tree: its findings, read by rcaRules() and never by the drawing. */
export interface RcaInfo {kind: RcaKind; findings: RcaFinding[]}
/** diagram({layoutCheck}): the severity of the `layout-*` findings. */
export type LayoutCheck = 'info' | 'strict';
/** diagram({status}): the state of the whole figure. Only 'draft' for now. */
export type DiagramStatus = 'draft';
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
  /** Glossary: {'ユーザー': ['利用者', 'ユザー']} — the word to use and the spellings that are reported (`term-avoid`). The project's `terms` apply too. */
  terms?: Readonly<Record<string, readonly string[]>>;
  legend?: 'auto' | false;
  legendLabels?: Partial<Record<NotationKey, string>>;
  tones?: ToneOverrides;
  /** Where a long label may break: 'phrase' (default) keeps a katakana run and a kanji run whole ('アプリ' is never ア/プ/リ); 'char' lets any CJK character end a line; 'bunsetsu' also keeps a hiragana with the character before it (breaks only after a hiragana that a non-hiragana follows, or after 、。) and widens tree-like boxes to their longest unit. */
  wrap?: 'phrase' | 'char' | 'bunsetsu';
  /** Never break a katakana word across lines: a box is at least as wide as its longest katakana word (up to the node width the component starts with, at most 240px). Default off: nothing changes for a figure that does not write it. A figure that does not fit with the floor is tried without it (the break is then reported by text-mid-word-break). Also settable for every diagram in `.svg-diagram.json` ("keepWords": true). */
  keepWords?: boolean;
  width: number;
  /** diagram({width: 'fit'}): renderDiagram narrows `width` to the content. */
  fitWidth?: boolean;
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
  status?: DiagramStatus;
  statusLabel?: string;
  layoutCheck?: LayoutCheck;
  tocCheck?: TocCheck;
  rcaCheck?: RcaCheck;
  evidenceCheck?: EvidenceCheck;
  bands: Band[];
  /** Set by build() from the measured slide (contentWidth). */
  usableWidth?: number;
  /** Project / diagram max width for the doc-width rule (config.ts applyConfig). */
  maxWidth?: number;
  /** The day for gantt({today: 'auto'}), given by the caller (config.ts applyConfig); the library never reads the clock. */
  today?: string;
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
  /** The figure's status (diagram({status})); only written when it has one. */
  status?: DiagramStatus;
  /** The day a gantt({today: 'auto'}) was drawn with (only then): check --drift --rebuild draws again with it. */
  today?: string;
  /** `build --no-source-line` (ADR 0023): the SVG was drawn without diagram({sourceLine}); a rebuild (check --drift --rebuild) and --stale read it. Absent when not used. */
  noSourceLine?: boolean;
  /** Cumulative reveal stage represented by this file. */
  reveal?: number;
  until?: number;
}
/**
 * ADR 0012: `scope` on a self-placing band (tree, mindmap, stateDiagram, causeTree, gantt, classDiagram, bpmn, quadrant, chart, bars,
 * image, swimlane, chevron / funnel / cycle / venn / concentric) registers its items as `<scope>.<id>`. connect() and spotlight
 * name one with the qualified name; the bare id works while only one item has it, and is an error when several do.
 */
export interface ScopeOpts {scope?: string}
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
/** Width of one break atom at (size, weight, font), from the batched measurement. */
export type WidthOf = (atom: string, size: number, weight: number, font: FontFamily) => number;
export interface MeasureRequest {text: string; size: number; weight?: number; font?: FontFamily}
export interface Measured {w: number; h: number}
/** [text, size, weight, font]: what collectTextRequests() reports for one string. */
export type TextRequest = [text: string, size: number, weight: number, font: FontFamily];
export interface WrapOptions {maxWidth: number; atomWidth: (atom: string) => number}
