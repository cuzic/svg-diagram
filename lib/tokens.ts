// Single source of truth for this deck's SVG diagram tone-and-manner tokens
// — color palette, font stacks, font-size roles, the emoji-detection regex,
// and the opacity ladder used for gradient-style grouping. lint-svg.ts
// imports ALLOWED_COLORS and EMOJI_RE from here so the linter and the
// diagram-builder (scripts/svg-diagram/lib/dsl.ts) can never silently
// drift apart on what counts as an allowed color or an emoji glyph.
//
// See docs/diagram-tone-and-manner.md for the narrative rules this encodes.

import type {ColorKey, Palette, Role, Theme, TextTone} from './types.ts';

export const PALETTE: Palette = {
  bg: '#ffffff',
  text: '#22201b',
  muted: '#6f6659',
  border: '#e0d6c5',
  code: '#f6f8fa',
  danger: '#b91c1c', // anti-pattern / danger call-outs only, not a general accent
  1: { accent: '#a8632b', soft: '#f1e3d3' }, // day1 "legacy" (amber)
  2: { accent: '#1f6e73', soft: '#dbeeee' }, // day2 "modern" (teal)
  // Named themes for diagrams outside the training deck: diagram({theme: 'blue'}).
  blue: { accent: '#1d5fa8', soft: '#dce9f7' },
  teal: { accent: '#1f6e73', soft: '#dbeeee' },
  amber: { accent: '#a8632b', soft: '#f1e3d3' },
};

// ---- tones: the ONE table from a tone name to the colours it paints ---------------------------------------------------
// Every place that turns a tone into colours reads this table (boxes, banners, legend swatches, tag pills, connector and text
// colours, wireframe chips / alerts / insight levels, plane() labels), so adding or changing a tone is one edit here, and one
// test (test/tones.test.ts) can check the contrast of every tone against every theme.
export type ToneName = 'plain' | 'accent' | 'danger' | 'muted' | 'new' | 'changed' | 'removed' | 'solid' | 'solid-danger';
export interface ToneStyle {
  /** Fill of a shape in this tone. */
  fill: ColorKey;
  /** Outline (null: none). */
  stroke: ColorKey | null;
  /** Doc-theme stroke differs from the slide decks' pale one only for 'muted'; this is the slide-deck value. */
  slideStroke?: ColorKey;
  /** Outline of the small pills / chips (wireframe), when it is not `stroke`. */
  chipStroke?: ColorKey;
  /** Text colour on `fill`. */
  text: ColorKey;
  /** The tone as a plain colour: a bar, a tag pill, a line, text written "in" this tone. */
  ink: ColorKey;
  /** Boxes of this tone are drawn with a dashed outline. */
  dashed: boolean;
  /** Text can be set in this tone (accent / danger / muted); the others write in the normal text colour. */
  asText: boolean;
}
export const TONES: Record<ToneName, ToneStyle> = {
  plain:          {fill: 'bg',     stroke: 'text',   chipStroke: 'muted', text: 'text',   ink: 'text',   dashed: false, asText: false},
  accent:         {fill: 'soft',   stroke: 'accent',                      text: 'accent', ink: 'accent', dashed: false, asText: true},
  new:            {fill: 'soft',   stroke: 'accent',                      text: 'text',   ink: 'accent', dashed: false, asText: false},
  changed:        {fill: 'bg',     stroke: 'accent',                      text: 'text',   ink: 'accent', dashed: false, asText: false},
  removed:        {fill: 'code',   stroke: 'muted',                       text: 'muted',  ink: 'muted',  dashed: true,  asText: false},
  muted:          {fill: 'code',   stroke: 'muted', slideStroke: 'border', chipStroke: 'border', text: 'muted', ink: 'muted', dashed: false, asText: true},
  danger:         {fill: 'bg',     stroke: 'danger',                      text: 'danger', ink: 'danger', dashed: true,  asText: true},
  solid:          {fill: 'accent', stroke: null,                          text: 'bg',     ink: 'accent', dashed: false, asText: false},
  'solid-danger': {fill: 'danger', stroke: null,                          text: 'bg',     ink: 'danger', dashed: false, asText: false},
};
/** Wireframe spellings of a tone: ok = accent, warn = danger, off = muted. */
export const TONE_ALIAS: Record<string, ToneName> = {ok: 'accent', warn: 'danger', off: 'muted'};
/** The style of a tone name (aliases resolved; an unknown or missing tone is 'plain'). */
export function toneStyle(tone: string | undefined): ToneStyle {
  const name = tone == null ? 'plain' : TONE_ALIAS[tone] ?? tone;
  return TONES[name as ToneName] ?? TONES.plain;
}
/** The colour key text in this tone uses ('text' unless the tone is one text can be set in). */
export const textKeyOf = (tone: string | undefined): ColorKey => { const t = toneStyle(tone); return t.asText ? t.ink : 'text'; };
/** A filled emphasis tone: the box is an accent / danger fill, so its text is white unless a run says otherwise (it may not). */
export const isSolidTone = (tone: string | undefined): boolean => tone === 'solid' || tone === 'solid-danger';
/** The colour of a box's text run: `bg` (white) when the box is solid and the run has no tone of its own, else the run's tone. */
export function runColorOf(runTone: TextTone | undefined, boxTone: string | undefined, theme: Theme): string {
  return isSolidTone(boxTone) && runTone === undefined ? colorOf('bg', theme) : textColorOf(runTone, theme);
}
/** A colour key resolved against a theme ('accent' and 'soft' are theme colours). */
export function colorOf(key: ColorKey, theme: Theme): string {
  return key === 'accent' || key === 'soft' ? PALETTE[theme][key] : PALETTE[key];
}
/** The colour of a TextTone (a text run, a connector line) in a theme. */
export const textColorOf = (tone: TextTone | undefined, theme: Theme): string => colorOf(textKeyOf(tone), theme);

// Palette keys diagram() accepts: 1, 2 (legacy day numbers) or a theme name.
// Object.keys makes them strings ('1', '2', 'blue', ...); PALETTE[key] indexes the numeric keys identically.
export const THEMES = Object.entries(PALETTE).filter(([, v]) => typeof v === 'object' && v.accent).map(([k]) => k);
const THEME_KEYS = THEMES as unknown as Theme[];

// Flat set of every hex value PALETTE can resolve to — this is exactly what
// lint-svg.ts's off-token-color check validates fill/stroke against.
export const ALLOWED_COLORS = new Set([
  PALETTE.bg, PALETTE.text, PALETTE.muted, PALETTE.border, PALETTE.code, PALETTE.danger,
  ...THEME_KEYS.flatMap(k => [PALETTE[k].accent, PALETTE[k].soft]),
]);

export const FONT_STACKS: Record<'sans' | 'mono' | 'emoji', string> = {
  sans: `'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','YuGothic',Meiryo,'Noto Sans JP',sans-serif`,
  mono: `'JetBrains Mono','SF Mono','Menlo','Consolas','Liberation Mono','Courier New',monospace`,
  emoji: `'Noto Color Emoji','Segoe UI Emoji',sans-serif`,
};

export const MIN_FONT_SIZE = 14;

/** The roles an opt-in text size (banner headlineRole, bars / plane labelRole) may name. */
export const HEADLINE_ROLES = ['banner', 'stat', 'display'] as const;
export const LABEL_ROLES = ['note', 'banner', 'stat'] as const;
/** What fill: true may scale an opted-in text size up to (px). The usual roles are scaled by up to 1.8 without this limit. */
export const OPT_IN_TEXT_MAX = 72;

// font-size (px) per semantic role. Every value is >= MIN_FONT_SIZE by
// construction — the DSL's normal box()/caption()/banner() path never lets a
// caller pick a raw px number outside this table.
export const ROLES: Record<Role, number> = {
  title: 15, label: 14, body: 14, note: 14, banner: 16, stat: 34, display: 56,
};

// Fixed sizes of text that is not a role: the label on a connector line and the tag pill on a box. Mutable only so
// renderDiagram's font scale (fill / canvas) can scale them with the roles; read them at use, never at import.
// layout.ts measures with these and emit.ts draws with them, so they are defined once, here.
/** diagram({canvas: 'slide'}): a 16:9 slide drawn 1:1; no text below `minText`. */
export const SLIDE_CANVAS = {width: 1280, height: 720, minText: 24};

export const FIXED_SIZES = {connectLabel: 14, tag: 14};
export const BASE_FIXED_SIZES = {...FIXED_SIZES};
// connect({weight: 'strong'}): line width, and its arrowhead (userSpaceOnUse: a head scaled by the width would bite into the box).
export const STRONG_STROKE = 5, STRONG_HEAD = 16, STRONG_HEAD_REF_X = 6;
// how far the line stops short of the box edge so the head's tip lands on it (the line must end where the head is wider than the line)
export const STRONG_TRIM = (10 - STRONG_HEAD_REF_X) * STRONG_HEAD / 10;

// Table cell marks (cell(text, {mark})): the symbol is what says "good / partial / bad", the tone only reinforces it.
export const CELL_MARKS: Record<'ok' | 'mid' | 'ng' | 'best', {glyph: string; tone: 'text' | 'accent' | 'danger'; bold: boolean}> = {
  ok: {glyph: '○', tone: 'accent', bold: false},
  mid: {glyph: '△', tone: 'text', bold: false},
  ng: {glyph: '×', tone: 'danger', bold: false},
  best: {glyph: '◎', tone: 'accent', bold: true},
};

// Opacity steps for gradient-style grouping (e.g. a segmented usage bar, or
// an N-group grid colored by "owner"). Index into this array — a free
// decimal isn't an off-token-color violation today, but isn't a token
// either; the DSL only ever emits these six values.
// See day1-01-context-usage-bar.svg / day1-02-modernize-assess.svg.
export const SHADES: number[] = [1.0, 0.8, 0.65, 0.5, 0.35, 0.15];

// Color-pictograph codepoints that need class="emoji" (Noto Color Emoji /
// Segoe UI Emoji fallback) because FONT_STACKS.sans has no emoji glyphs.
// Deliberately excludes U+2600-27BF dingbats (✓/✗ etc.), which render fine
// in the sans stack — see docs/diagram-tone-and-manner.md §3.5.
export const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2B50}\u{26A0}\u{2764}]/u;

// Perceptual-ish luminance (ITU-R BT.601) of a "#rrggbb" token — used to pick
// a readable text color against a fill whose alpha isn't 1 (pyramid() layers
// use fill-opacity, so the *effective* background isn't one of PALETTE's
// solid tokens; this is what lets that choice stay structural instead of
// hand-picked per diagram).
export function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Approximates alpha-compositing `overlayHex` at `alpha` over `baseHex` —
// close enough to true sRGB blending for choosing text color (the real
// composited pixel is only ever checked by lint-svg.ts's Playwright render,
// which is exact; this just needs to be right often enough that that check
// stays a formality).
export function blendLuminance(baseHex: string, overlayHex: string, alpha: number): number {
  return luminance(baseHex) * (1 - alpha) + luminance(overlayHex) * alpha;
}

// Whichever of white / PALETTE.text has the larger luminance delta against
// a known background luminance — used where a fixed tone (like box() tones)
// isn't available because the background is a computed blend.
export function bestTextColor(bgLuminance: number): string {
  const whiteDelta = Math.abs(255 - bgLuminance);
  const textDelta = Math.abs(luminance(PALETTE.text) - bgLuminance);
  return whiteDelta >= textDelta ? '#ffffff' : PALETTE.text;
}

// WCAG 2.x relative luminance and contrast ratio ("#rrggbb" in, 1..21 out).
// Text needs >= 4.5:1; meaningful non-text (borders, lines, icons) needs >= 3:1.
export function relativeLuminance(hex: string): number {
  const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function wcagRatio(a: string, b: string): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
