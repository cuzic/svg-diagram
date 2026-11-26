// The types of comic() (ADR 0074): the meaning-first data (templates and who stands where; no coordinates), and the laid-out band.
import type {Anchor, Dimmed, Rect, RevealOpts, ScopeOpts} from './core.ts';

export type ComicLayoutName = '1x4' | '2x2' | '1x3' | '1x2';
/** The width : height of a panel. */
export type ComicAspect = '7:5' | '6:5' | '1:1';
export type ComicAt = 'left' | 'center' | 'right';
export type ComicExpression = 'neutral' | 'smile' | 'laugh' | 'surprise' | 'worry' | 'angry' | 'think' | 'sad';
export type BubbleKind = 'say' | 'think' | 'shout' | 'narration';

export interface ComicCast {name: string; asset?: string; face?: {hue: number; hair?: 'short' | 'long'}}

/** Which sides of a character the bubbles may lean to (the `anchor` override check of a later unit reads it). */
export type BubbleSide = 'top-left' | 'top' | 'top-right' | 'left' | 'right';
/** A character from an artist's material: one JSON with a fragment per expression (ADR 0074 D3). Coordinates are the box's. */
export interface CharacterManifest {
  id: string;
  name: string;
  /** [x, y, width, height]: the viewBox the fragments are drawn in. Not made square. */
  box: readonly [number, number, number, number];
  anchors: {
    head: {cx: number; cy: number; r: number};
    mouth: readonly [number, number];
    hand?: readonly [number, number];
    /** The highest artwork y across expressions, between the box top and the head top. The check spans the box's full width, so crop the box to the artwork to avoid hits from bubbles beside it. Defaults to the head top. */
    top?: number;
  };
  bubbleSides?: readonly BubbleSide[];
  /** SVG fragments (shapes, groups, gradients and clip paths only), by expression; `neutral` at least. */
  expressions: Readonly<Partial<Record<ComicExpression, string>>>;
  license: {spdx: string; author: string; url: string};
}
/** A loaded character: the manifest with every fragment cleaned (plain JSON). */
export interface ComicCharacter {
  id: string;
  name: string;
  box: [number, number, number, number];
  anchors: {head: {cx: number; cy: number; r: number}; mouth: [number, number]; hand?: [number, number]; top?: number};
  bubbleSides: BubbleSide[];
  expressions: Partial<Record<ComicExpression, string>>;
  license: {spdx: string; author: string; url: string};
}
/** A blank of a template (`{id}`): how many full-width characters it may take, and what the empty blank says. */
export interface ComicSlotDef {max?: number; prompt: string; fallback?: string; choices?: readonly string[]; strict?: boolean}
/** A worksheet's filled (string) and skipped (null) slots. An absent key leaves its slot empty. */
export type Values = Record<string, string | null>;
/** One line of speech (shared with the chat band): a template with blanks, and who says it. */
export interface ComicDialogue {
  id: string;
  /** The speaker (a key of `cast`). Not needed for a narration. */
  who?: string;
  kind: BubbleKind;
  tpl: string;
  slots?: Readonly<Record<string, ComicSlotDef>>;
}
export interface ComicStage {who: string; at: ComicAt; expression: ComicExpression}
export interface ComicPanel {
  id: string;
  bg?: {tint?: 'warm' | 'cool' | 'plain'; icon?: string};
  thumb?: boolean;
  stage: readonly ComicStage[];
  /** In reading order. */
  dialogue: readonly ComicDialogue[];
}
export interface ComicWorksheet {
  version: 1;
  title: string;
  layout: ComicLayoutName;
  cast: Readonly<Record<string, ComicCast>>;
  panels: readonly ComicPanel[];
  numbering?: boolean;
  labels?: readonly string[];
  blank?: 'prompt' | 'line';
}
export interface ComicOpts extends RevealOpts, ScopeOpts {
  id?: string;
  /** The width : height of a panel (default: 6:5 for a column of panels, 1:1 for 2x2). */
  aspect?: ComicAspect;
  /** 'horizontal' only (ADR 0074 Q1: vertical text is the second version). */
  writing?: 'horizontal';
  /** 'ltr' only (a right-to-left reading order goes with vertical text). */
  dir?: 'ltr';
  /** Artists' characters by manifest id, for the cast entries that name an `asset` (given per drawing, never kept in a global). */
  characters?: Readonly<Record<string, CharacterManifest>>;
}
export interface ComicBand extends Omit<ComicOpts, 'characters'> {
  type: 'comic';
  sheet: ComicWorksheet;
  /** The loaded characters (cleaned; plain JSON). */
  characters?: Readonly<Record<string, ComicCharacter>>;
}

export type ComicRule =
  | 'comic-speaker-unknown' | 'comic-at-collision' | 'comic-panel-count' | 'comic-slots-per-panel' | 'comic-slot-duplicate' | 'comic-slot-undefined'
  | 'comic-slot-max' | 'comic-slot-prompt' | 'comic-bubble-covers-face' | 'comic-tail-off-speaker' | 'comic-tail-crosses-bubble' | 'comic-bubble-zone' | 'comic-text-budget'
  | 'comic-asset-missing' | 'comic-bubble-wide' | 'comic-orphan-line' | 'comic-follower-split'
  | 'comic-value-invalid' | 'comic-values-unknown' | 'slot-overflow'
  | 'chat-speaker-unknown' | 'chat-input-wide';
/** Layout findings feed the verdict or lint. Value findings are returned separately by renderComic. */
export interface ComicFinding {rule: ComicRule; severity: 'problem' | 'advice'; where: string; message: string}

/** ViewBox coordinates by scoped comic id. */
export interface ComicGeometry {
  panels: Record<string, Rect>;
  bubbles: Record<string, Rect>;
  slots: Record<string, Rect>;
  heads: Record<string, Rect>;
  points: Record<string, {mouth: [number, number]; head: [number, number, number]}>;
}

/** A run of text on one line: the literal atoms between two blanks, drawn as one <text>. */
export interface ComicRun {x: number; y: number; text: string}
export interface ComicLaidSlot {id: string; x: number; y: number; w: number; h: number; max: number; prompt: string; fallback: string; defined?: false}
export interface ComicLaidBubble {
  /** `panel.dialogue` (a scope qualifies it in the registry, not here). */
  id: string;
  panel: string;
  kind: BubbleKind;
  who?: string;
  x: number; y: number; w: number; h: number;
  /** The text lines (the template with every blank at its widest), as written: a blank is `{id}`. */
  lines: string[];
  runs: ComicRun[];
  slots: ComicLaidSlot[];
  /** The tail: its two base points and its tip. Left out for a narration (and for a bubble with no speaker). */
  tail?: {base: [[number, number], [number, number]]; tip: [number, number]; from: [number, number]};
  /** The text of the `<title>`: the template with the blanks empty. */
  title: string;
  /** Source of the title when a value is drawn. */
  template?: string;
}
/** How a head is drawn: the built-in face (hue and hair), or an artist's character (its manifest id). */
export type ComicLook = {kind: 'face'; hue: number; hair: 'short' | 'long'} | {kind: 'asset'; asset: string};
export interface ComicLaidHead {id: string; who: string; name: string; expression: ComicExpression; look: ComicLook; cx: number; cy: number; r: number; mouth: [number, number]; /** the character's hand anchor on the panel, when it has one */ hand?: [number, number]}
export interface ComicLaidPanel {
  id: string; x: number; y: number; w: number; h: number;
  /** The badge text (a number or a label); left out with `numbering: false`. */
  label?: string;
  tint: 'warm' | 'cool' | 'plain';
  heads: ComicLaidHead[];
}
export interface ComicText {x: number; y: number; size: number; text: string}
export interface LaidOutComic extends Dimmed {
  type: 'comic';
  id?: string; reveal?: number; until?: number;
  x: number; y: number; w: number; h: number;
  title: string;
  layout: ComicLayoutName;
  aspect: ComicAspect;
  blank: 'prompt' | 'line';
  panels: ComicLaidPanel[];
  bubbles: ComicLaidBubble[];
  /** The panels, bubbles and slots, as the names connect() uses (`p1`, `p1.d2`, `day`). */
  anchors: Anchor[];
  /** Set only on the copy prepared for SVG output with nodeIds. */
  nodeIds?: true;
  /** The text sizes the band draws (the fit check reads them). */
  texts: ComicText[];
  findings: ComicFinding[];
  /** The characters of the cast's assets, loaded: the drawing needs their fragments. */
  characters: Record<string, ComicCharacter>;
}
