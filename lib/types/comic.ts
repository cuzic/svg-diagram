// The types of comic() (ADR 0074): the meaning-first data (templates and who stands where; no coordinates), and the laid-out band.
import type {Anchor, Dimmed, RevealOpts, ScopeOpts} from './core.ts';

export type ComicLayoutName = '1x4' | '2x2' | '1x3' | '1x2';
/** The width : height of a panel. */
export type ComicAspect = '7:5' | '6:5' | '1:1';
export type ComicAt = 'left' | 'center' | 'right';
export type ComicExpression = 'neutral' | 'smile' | 'laugh' | 'surprise' | 'worry' | 'angry' | 'think' | 'sad';
export type BubbleKind = 'say' | 'think' | 'shout' | 'narration';

export interface ComicCast {name: string; asset?: string; face?: {hue: number; hair?: 'short' | 'long'}}
/** A blank of a template (`{id}`): how many full-width characters it may take, and what the empty blank says. */
export interface ComicSlotDef {max?: number; prompt: string; fallback?: string; choices?: readonly string[]; strict?: boolean}
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
}
export interface ComicBand extends ComicOpts {
  type: 'comic';
  sheet: ComicWorksheet;
}

export type ComicRule =
  | 'comic-speaker-unknown' | 'comic-at-collision' | 'comic-panel-count' | 'comic-slots-per-panel' | 'comic-slot-duplicate' | 'comic-slot-undefined'
  | 'comic-slot-max' | 'comic-slot-prompt' | 'comic-bubble-covers-face' | 'comic-tail-off-speaker' | 'comic-tail-crosses-bubble' | 'comic-bubble-zone' | 'comic-text-budget'
  | 'comic-bubble-wide' | 'comic-orphan-line' | 'comic-follower-split';
/** A problem is a mistake in the data or the layout (the check fails); an advice is a hint (a lint finding). */
export interface ComicFinding {rule: ComicRule; severity: 'problem' | 'advice'; where: string; message: string}

/** A run of text on one line: the literal atoms between two blanks, drawn as one <text>. */
export interface ComicRun {x: number; y: number; text: string}
export interface ComicLaidSlot {id: string; x: number; y: number; w: number; h: number; max: number; prompt: string; fallback: string}
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
}
export interface ComicLaidHead {id: string; who: string; name: string; expression: ComicExpression; cx: number; cy: number; r: number; mouth: [number, number]}
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
  /** The panels and the bubbles, as the names connect() uses (`p1`, `p1.d2`). */
  anchors: Anchor[];
  /** The text sizes the band draws (the fit check reads them). */
  texts: ComicText[];
  findings: ComicFinding[];
}
