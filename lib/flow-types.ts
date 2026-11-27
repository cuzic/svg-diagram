import type {LoopBack} from './types/containers.ts';
import type {EmblemShape} from './emblem-shapes.ts';
import type {Anchor, Dimmed, EmphasisTone, FocusOpts, Rect, RevealOpts, ScopeOpts, TextTone} from './types/core.ts';

/** `tone` 'solid' / 'solid-danger' fill the step (white text). */
export interface FlowStep {label: string; sub?: string; id?: string; tone?: EmphasisTone}
export interface ChevronOpts extends RevealOpts, ScopeOpts, FocusOpts {/** The arrows back to earlier steps, drawn under a horizontal chevron: `{from: 4, to: 2, label}` (1-based numbers or item ids). Several loops must nest. */ loopBack?: LoopBack | readonly LoopBack[]; id?: string; direction?: 'horizontal' | 'vertical'; first?: 'pentagon' | 'chevron'; gap?: number; current?: number; highlight?: number; width?: number; /** Wrap a horizontal chevron onto this many rows (ADR 0082); 'auto' is the fewest rows where no step's text wraps. Default 1. */ rows?: number | 'auto'; /** How many steps one row holds (ADR 0082). Not together with `rows`. */ perRow?: number}
export interface FunnelStage {label: string; value?: number; id?: string; tone?: EmphasisTone}
export interface FunnelOpts extends RevealOpts, ScopeOpts, FocusOpts {id?: string; scale?: 'value' | 'even'; showRate?: boolean; width?: number}
/** A link of a cycle with `links` (ADR 0065): two steps (1-based number, id or label), two-way unless `direction: 'forward'`. */
export interface CycleLink {from: number | string; to: number | string; label?: string; direction?: 'both' | 'forward'}
export interface CycleOpts extends RevealOpts, ScopeOpts, FocusOpts {
  id?: string; centre?: string; direction?: 'cw' | 'ccw'; width?: number;
  /** ADR 0065: instead of the arrows round the ring, the steps on a regular polygon joined pair by pair — 'all' (every pair, two-way; up to 6 steps) or the links to draw. The CBT five-part model. */
  links?: 'all' | readonly CycleLink[];
  /** ADR 0065: a frame round the figure, and its name (the five-part model's 「状況・環境」). */
  frame?: string;
}
export interface VennSet {name: string; label?: string; /** Short bullet lines drawn under the set's title, inside the part only this set covers. */ items?: readonly string[]; id?: string; tone?: TextTone}
export interface VennOverlap {sets: readonly string[]; label: string}
export interface VennOpts extends RevealOpts, ScopeOpts {id?: string; overlaps?: readonly VennOverlap[]; centre?: string; universe?: string | boolean; width?: number}
export interface ConcentricRing {label: string; description?: string; id?: string; tone?: TextTone}
export type {EmblemShape} from './emblem-shapes.ts';
export interface EmblemItem {label: string; sub?: string; shape?: EmblemShape; id?: string; tone?: EmphasisTone}
export interface EmblemOpts extends RevealOpts, ScopeOpts, FocusOpts {id?: string; /** The shape of every item that does not name its own. */ shape?: EmblemShape; gap?: number; /** The least width of a shape (the shapes grow to hold their text, all to the same size). */ minSize?: number; width?: number}
export interface ValueChainOpts extends RevealOpts, ScopeOpts, FocusOpts {id?: string; /** The label of the margin arrow at the right end; `false` leaves the arrow out. Default 'マージン'. */ margin?: string | false; /** The captions over the support bars and the primary chevrons; `false` leaves them out. Default ['支援活動', '主活動']. */ titles?: readonly [support: string, primary: string] | false; width?: number}
export interface ConcentricOpts extends RevealOpts, ScopeOpts {
  id?: string; order?: 'outer-first' | 'inner-first'; labels?: 'inside' | 'side'; centre?: string; width?: number;
  /** ADR 0065: the rings cut into sectors, from 12 o'clock clockwise (1-8): the Values Bullseye's life domains, a technology radar's quadrants. */
  sectors?: readonly ConcentricSector[];
  /** ADR 0065: marks in the sectors (needs `sectors`). */
  marks?: readonly ConcentricMark[];
  /** The two words of the key under the figure when a mark has `from` — where it was, where it is (default ['前回', '今回']); false leaves the key out. */
  fromLegend?: readonly [was: string, now: string] | false;
  /** ADR 0065: with sectors, how the same rings, sectors and marks are drawn — 'circle' (default: rings cut into sectors) or 'stack' (a column of boxes per sector, the innermost ring the top row). */
  layout?: 'circle' | 'stack';
}
/** A sector of a concentric (ADR 0065). */
export interface ConcentricSector {label: string; id?: string}
/** A ring or a sector by its 1-based number (as `rings` / `sectors` are written) or its label (or id). */
export type ConcentricRef = number | string;
/** Where a mark was last time: its ring (or r), and its sector when that changed. */
export interface ConcentricPlace {ring?: ConcentricRef; r?: number; sector?: ConcentricRef}
/** A mark in a sector, at a ring (its middle) or at r (0 = the centre, 1 = the outer edge); `from` draws the move since last time. */
export interface ConcentricMark {label: string; sector: ConcentricRef; ring?: ConcentricRef; r?: number; id?: string; tone?: TextTone; from?: ConcentricPlace}
export interface ChevronBand extends Omit<ChevronOpts, 'focus'> {type: 'chevron'; steps: FlowStep[]; direction: 'horizontal' | 'vertical'; first: 'pentagon' | 'chevron'; gap: number}
export interface FunnelBand extends Omit<FunnelOpts, 'focus'> {type: 'funnel'; stages: FunnelStage[]; scale: 'value' | 'even'; showRate: boolean}
export interface CycleBand extends Omit<CycleOpts, 'focus' | 'links'> {type: 'cycle'; steps: FlowStep[]; direction: 'cw' | 'ccw'; /** resolved: 0-based steps */ links?: {from: number; to: number; label?: string; both: boolean}[]}
export interface VennBand extends VennOpts {type: 'venn'; sets: VennSet[]; overlaps: VennOverlap[]}
/** Where a mark is: a ring (0-based from the centre; drawn at its middle) or r (0..1 of the radius). */
export type MarkAt = {ring: number} | {r: number};
/** A mark with its sector (0-based) and place resolved; `from` likewise. */
export interface ConcentricPlaced {label: string; id?: string; tone: TextTone; sector: number; at: MarkAt; from?: {sector: number; at: MarkAt}}
export interface ConcentricBand extends Omit<ConcentricOpts, 'sectors' | 'marks'> {type: 'concentric'; rings: ConcentricRing[]; order: 'outer-first' | 'inner-first'; labels: 'inside' | 'side'; sectors?: ConcentricSector[]; marks?: ConcentricPlaced[]}
export interface EmblemBand extends Omit<EmblemOpts, 'focus'> {type: 'emblem'; items: EmblemItem[]; shape: EmblemShape; gap: number}
export interface ValueChainBand extends Omit<ValueChainOpts, 'focus'> {type: 'valueChain'; support: FlowStep[]; primary: FlowStep[]; margin: string | false; titles: readonly [string, string] | false}
export type FlowShapeBand = ChevronBand | FunnelBand | CycleBand | VennBand | ConcentricBand | EmblemBand | ValueChainBand;

/** A flow-shape text's colour: a text tone, or 'bg' (white) on a filled (solid) item. */
export type FlowTextTone = TextTone | 'bg';
export interface FlowText extends Rect {text: string; tx: number; ty: number; size: number; weight: 400 | 700; anchor: 'start' | 'middle' | 'end'; tone: FlowTextTone; /** ADR 0054: the part it is grouped in (a concentric ring's key). */ part?: string}
export type FlowPrimitive =
  | ({k: 'polygon'; points: [number, number][]; tone: EmphasisTone; strong?: boolean; /** the id of the item this is the frame of (ADR 0034: withNodeIds turns it into `dataNode`) */ node?: string; dataNode?: string; /** ADR 0054 */ part?: string} & Dimmed)
  | ({k: 'circle'; cx: number; cy: number; r: number; tone: TextTone; opacity?: number; dash?: string; /** Drawn as a box of this tone (filled, outlined) instead of a tinted ring. */ fill?: EmphasisTone; node?: string; dataNode?: string; /** ADR 0054 */ part?: string} & Dimmed)
  | ({k: 'rect'; x: number; y: number; w: number; h: number; tone: TextTone} & Dimmed)
  | ({k: 'path'; d: string; tone: TextTone; arrow?: boolean; thin?: boolean; /** Drawn as a box of this tone (filled, outlined) instead of a line; `box` is the extent of what is drawn. */ fill?: EmphasisTone; box?: Rect; node?: string; dataNode?: string; /** ADR 0054 */ part?: string} & Dimmed);
export interface LaidOutFlowShape extends Rect, Dimmed {type: FlowShapeBand['type']; id?: string; reveal?: number; until?: number; primitives: FlowPrimitive[]; texts: FlowText[]; /** chevron: the 1-based steps whose words are wider than their arrow (rows 'auto' or no rows given; with `rows` / `perRow` it throws). */ wide?: number[]; anchors: Anchor[]; labelBoxes: (Rect & {label: string})[]; /** emblem: the bounding box of each shape that has an id (the checks' obstacle, which may be larger than its anchor). */ bounds?: Anchor[]; /** concentric with sectors (ADR 0065): the marks whose label could only be placed across a line */ crossings?: string[]; /** venn: sets whose title and items do not fit inside the part only that set covers */ misfits?: string[]}
