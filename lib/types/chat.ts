// The types of chat() (ADR 0074 D7): the same dialogue and cast as comic(), as a chat screen. The data is meaning-first (no coordinates); the layout works the sizes out.
import type {BubbleKind, CharacterManifest, ComicCast, ComicCharacter, ComicDialogue, ComicFinding, ComicLaidSlot, ComicLook, ComicRun, ComicText, ComicWorksheet} from './comic.ts';
import type {Anchor, Dimmed, RevealOpts, ScopeOpts} from './core.ts';

/** One message: a line of a worksheet's dialogue. `panel` is the comic panel it came from (separators go between panels). */
export interface ChatMessage extends ComicDialogue {panel?: string}
/** A dialogue list and its cast: the other input of chat() (a `ComicWorksheet` is accepted too). */
export interface ChatSheet {
  version: 1;
  title: string;
  cast: Readonly<Record<string, ComicCast>>;
  dialogue: readonly ChatMessage[];
  blank?: 'prompt' | 'line';
}
export interface ChatOpts extends RevealOpts, ScopeOpts {
  id?: string;
  /** The band's width in px, 480 (default) to 880 in steps of 4. The column and the 70% wrap width scale with it (D7). */
  width?: number;
  /** The cast key whose lines are on the right (default 'me'). */
  self?: string;
  /** A thin line between the panels of a worksheet (default off; a dialogue list has no panels). */
  separators?: boolean;
  /** A message box at the bottom, as a chat app draws it: its placeholder text (`true`: a stock text). */
  input?: string | true;
  /** Artists' characters by manifest id, for the cast entries that name an `asset` (given per drawing, never kept in a global). */
  characters?: Readonly<Record<string, CharacterManifest>>;
}
export interface ChatBand extends Omit<ChatOpts, 'characters' | 'input'> {
  type: 'chat';
  sheet: ChatSheet;
  /** The text of the message box; left out when there is none. */
  input?: string;
  /** The loaded characters (cleaned; plain JSON). */
  characters?: Readonly<Record<string, ComicCharacter>>;
}

export interface ChatLaidBubble {
  /** The message id (`panel.dialogue` for a worksheet, the dialogue id for a list). */
  id: string;
  panel?: string;
  kind: BubbleKind;
  who?: string;
  /** On the right (the `self` speaker). */
  mine: boolean;
  x: number; y: number; w: number; h: number;
  lines: string[];
  runs: ComicRun[];
  slots: ComicLaidSlot[];
  /** The tail on the first bubble of a run, on the outer side (a narration has none). */
  tail?: 'left' | 'right';
  title: string;
  template?: string;
}
/** The round face and the name of the speaker, on the first message of a run of one speaker's messages. */
export interface ChatLaidAvatar {
  id: string;
  who: string;
  name: string;
  look: ComicLook;
  cx: number; cy: number; r: number;
  /** The name's text position (start-anchored). */
  nameX: number; nameY: number;
}
export interface ChatLaidInput {x: number; y: number; w: number; h: number; text: string; textX: number; textY: number; send: {cx: number; cy: number; r: number}}
export interface LaidOutChat extends Dimmed {
  type: 'chat';
  id?: string; reveal?: number; until?: number;
  x: number; y: number; w: number; h: number;
  title: string;
  blank: 'prompt' | 'line';
  /** The bubbles' column: the width a bubble may take, from its edge. */
  column: number;
  bubbles: ChatLaidBubble[];
  avatars: ChatLaidAvatar[];
  /** The y of each separator line (between panels). */
  separators: {y: number; x1: number; x2: number}[];
  input?: ChatLaidInput;
  anchors: Anchor[];
  /** Set only on the copy prepared for SVG output with nodeIds. */
  nodeIds?: true;
  texts: ComicText[];
  findings: ComicFinding[];
  characters: Record<string, ComicCharacter>;
}
export type ChatInput = ComicWorksheet | ChatSheet;
