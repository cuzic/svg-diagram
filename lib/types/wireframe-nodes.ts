// Types: wf.* nodes and wireframe drawing primitives.
import type {BadgeBox} from '../badge.ts';
import type {Align, ColorKey, WidthOf, WrapMode} from './core.ts';
import type {ToneEnv} from '../tokens.ts';

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
  /** The diagram's tone overrides (chips, alerts and tone-coloured text are drawn in them). */
  tones: ToneEnv;
  /** diagram({wrap}): where the labels may break. */
  wrap: WrapMode;
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
