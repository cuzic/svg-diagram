// Single source of truth for this deck's SVG diagram tone-and-manner tokens
// — color palette, font stacks, font-size roles, the emoji-detection regex,
// and the opacity ladder used for gradient-style grouping. lint-svg.ts
// imports ALLOWED_COLORS and EMOJI_RE from here so the linter and the
// diagram-builder (scripts/svg-diagram/lib/dsl.ts) can never silently
// drift apart on what counts as an allowed color or an emoji glyph.
//
// See docs/diagram-tone-and-manner.md for the narrative rules this encodes.

import type {ColorKey, PlainColorKey, Palette, Role, Roles, Theme, TextTone, Appearance} from './types/core.ts';

import {must} from './must.ts';
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

// ---- dark appearance ----------------------------------------------------------------------------------------------------
// The dark token set is a one-to-one recolouring of the light one: every light token hex maps to a dark hex (DARK_OF), and an
// 'appearance: dark' diagram is drawn with the light tokens and recoloured at the end (recolor()). So the layout, the tones and the
// roles are untouched, and a new tone needs no dark spelling. Dark hexes never coincide with a light hex, so recolor() is idempotent.
// Contrast of every (text, fill) pair of every theme is checked in test/dark-theme.test.ts.
export const DARK_PALETTE = {
  bg: '#1b1a17', text: '#ece6da', muted: '#a79e8e', border: '#4a443a', code: '#24221e', danger: '#f05252',
  amber: {accent: '#e0a066', soft: '#3b2f22'},
  teal: {accent: '#5fc1c6', soft: '#1f3a3b'},
  blue: {accent: '#7ab2ee', soft: '#1f3350'},
} as const;
const DARK_OF: Record<string, string> = {
  [PALETTE.bg]: DARK_PALETTE.bg, [PALETTE.text]: DARK_PALETTE.text, [PALETTE.muted]: DARK_PALETTE.muted,
  [PALETTE.border]: DARK_PALETTE.border, [PALETTE.code]: DARK_PALETTE.code, [PALETTE.danger]: DARK_PALETTE.danger,
  [PALETTE.amber.accent]: DARK_PALETTE.amber.accent, [PALETTE.amber.soft]: DARK_PALETTE.amber.soft,
  [PALETTE.teal.accent]: DARK_PALETTE.teal.accent, [PALETTE.teal.soft]: DARK_PALETTE.teal.soft,
  [PALETTE.blue.accent]: DARK_PALETTE.blue.accent, [PALETTE.blue.soft]: DARK_PALETTE.blue.soft,
};
/** Every light token hex (the keys of the light→dark map). */
export const LIGHT_COLORS: ReadonlySet<string> = new Set(Object.keys(DARK_OF));
const HEX6 = /^#[0-9a-fA-F]{6}$/;
/** The light→dark map of an appearance (null: light). An object appearance replaces the named tokens of the built-in dark set. */
const MAPS = new Map<string, Record<string, string>>();
export function mapOf(env: ToneEnv, appearance: Appearance | undefined): Record<string, string> | null {
  const m = baseMapOf(appearance);
  if (!m || !Object.keys(env.pairs).length) return m;
  let out = env.merged.get(m); // a tone override's dark colour joins the dark set
  if (!out) { out = {...m, ...env.pairs}; env.merged.set(m, out); }
  return out;
}
function baseMapOf(appearance: Appearance | undefined): Record<string, string> | null {
  if (appearance === undefined || appearance === 'light' || appearance === 'auto') return null; // 'auto' is drawn light; its dark side is an @media block (lib/appearance-auto.ts)
  if (appearance === 'dark') return DARK_OF;
  const key = JSON.stringify(appearance.dark);
  let m = MAPS.get(key);
  if (!m) {
    const o = appearance.dark;
    for (const [k, v] of Object.entries(o)) if (!['bg', 'text', 'muted', 'border', 'code', 'danger', 'accent', 'soft'].includes(k) || !HEX6.test(String(v))) throw new Error(`diagram({appearance: {dark: {${k}}}}): keys are bg, text, muted, border, code, danger, accent, soft, with a #rrggbb value (got ${String(v)})`);
    const get = (k: keyof typeof o, fallback: string) => (o[k] ?? fallback).toLowerCase();
    m = {...DARK_OF};
    for (const k of ['bg', 'text', 'muted', 'border', 'code', 'danger'] as const) m[PALETTE[k]] = get(k, must(DARK_OF[PALETTE[k]]));
    for (const t of ['amber', 'teal', 'blue'] as const) for (const k of ['accent', 'soft'] as const) if (o[k]) m[PALETTE[t][k]] = must(o[k]).toLowerCase();
    MAPS.set(key, m);
  }
  return m;
}
/** The colours a custom dark set adds to what a lint may see (lint-svg reads them from the root's data-palette). */
export const customColors = (appearance: Appearance | undefined): string[] => typeof appearance === 'object' ? Object.values(appearance.dark).map(h => h.toLowerCase()) : [];
/** A light token hex in the appearance's built-in set (a tone override's dark pair is not in it: see mapOf; anything that is not a token, such as a raw() colour, stays as it is). */
export const darkOf = (hex: string, appearance: Appearance = 'dark'): string => baseMapOf(appearance)?.[hex.toLowerCase()] ?? hex;
/** The colour mapper of an appearance: dark recolours, light (or none) leaves colours alone. */
export const paintOf = (env: ToneEnv, appearance: Appearance | undefined): ((hex: string) => string) => { const m = mapOf(env, appearance); return m ? (h => m[h.toLowerCase()] ?? h) : (h => h); };
/** Recolour the colours of emitted SVG / HTML with the appearance's token set. Only colour-bearing places are rewritten: the <style> CSS,
 *  and the fill / stroke / stop-color / flood-color / color / style / data-assumed-bg attributes of a tag. Text content, <title>, <desc>,
 *  <metadata> and other attributes (aria-label ...) can say "#ffffff" and keep it. Once only: a custom colour may equal a light token. */
export const recolor = (env: ToneEnv, text: string, appearance: Appearance | undefined): string => {
  if (!mapOf(env, appearance)) return text;
  const p = paintOf(env, appearance), hex = (v: string) => v.replace(/#[0-9a-fA-F]{6}\b/g, h => p(h));
  const attrs = /(\s(?:fill|stroke|stop-color|flood-color|color|style|data-assumed-bg)=")([^"]*)"/g;
  return text.replace(/<style[\s\S]*?<\/style>|<[^>]*>/g, part => part.startsWith('<style') ? hex(part) : part.replace(attrs, (_m, pre: string, v: string) => `${pre}${hex(v)}"`));
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
export function toneStyle(env: ToneEnv, tone: string | undefined): ToneStyle {
  const name = tone == null ? 'plain' : TONE_ALIAS[tone] ?? tone;
  return env.styles[name as ToneName] ?? TONES[name as ToneName] ?? TONES.plain;
}

// ---- tone overrides ---------------------------------------------------------------------------------------------------
// diagram({tones: {accent: {fill: '#e6d3bd', dark: {fill: '#4a3a28'}}}}) and .svg-diagram.json "tones" replace single colours of a
// tone. toneStyle() is the one door every consumer (emit, rules, verify, pptx) goes through, so the overridden colours are what is drawn AND
// what the contrast / gray-tone-collision checks see. The overrides of a diagram are a value, a ToneEnv (ADR 0031 §2): the pipeline entry
// points make it once from the diagram's `tones` with toneEnv() and hand it down, so nothing depends on which diagram ran before.
export type ToneColorKey = 'fill' | 'stroke' | 'text' | 'ink';
const TONE_COLOR_KEYS: readonly ToneColorKey[] = ['fill', 'stroke', 'text', 'ink'];
export type ToneColors = Partial<Record<ToneColorKey, string>>;
/** One tone's replacement colours (#rrggbb). `dark` is what the same colour becomes under appearance 'dark' (unset: it stays as is). */
export interface ToneOverride extends ToneColors {dark?: ToneColors}
export type ToneOverrides = Partial<Record<ToneName, ToneOverride>>;
/** The tone overrides of one diagram, resolved: the styles they change, the light→dark pairs, and every colour used. `merged` caches mapOf's table per base table. */
export interface ToneEnv {
  readonly styles: Readonly<Partial<Record<ToneName, ToneStyle>>>;
  readonly pairs: Readonly<Record<string, string>>;
  readonly colors: readonly string[];
  readonly merged: Map<Record<string, string>, Record<string, string>>;
}
/** No overrides: the built-in tones. */
export const NO_TONES: ToneEnv = {styles: {}, pairs: {}, colors: [], merged: new Map()};
const HEX = /^#[0-9a-fA-F]{6}$/;
const checkColors = (c: unknown, where: string): ToneColors => {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) throw new Error(`${where} must be an object like {fill: '#e6d3bd'}`);
  const out: ToneColors = {};
  for (const [k, v] of Object.entries(c)) {
    if (!(TONE_COLOR_KEYS as readonly string[]).includes(k)) throw new Error(`${where}: unknown colour "${k}" (one of ${TONE_COLOR_KEYS.join(', ')})`);
    if (typeof v !== 'string' || !HEX.test(v)) throw new Error(`${where}.${k} must be a #rrggbb colour (got ${JSON.stringify(v)})`);
    out[k as ToneColorKey] = v.toLowerCase();
  }
  return out;
};
/** Validate a `tones` value (a diagram option or the config's): tone names must exist, colours are #rrggbb. Returns it normalised (lower-case hex). */
export function checkTones(input: unknown, where: string): ToneOverrides {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error(`${where} must be an object like {accent: {fill: '#e6d3bd'}}`);
  const out: ToneOverrides = {};
  for (const [name, v] of Object.entries(input)) {
    if (!(name in TONES)) throw new Error(`${where}: unknown tone "${name}" (one of ${Object.keys(TONES).join(', ')}${name in TONE_ALIAS ? `; "${name}" is an alias of "${TONE_ALIAS[name]}"` : ''})`);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${where}.${name} must be an object like {fill: '#e6d3bd'}`);
    const {dark, ...light} = v as Record<string, unknown>;
    const o: ToneOverride = checkColors(light, `${where}.${name}`);
    if (dark !== undefined) o.dark = checkColors(dark, `${where}.${name}.dark`);
    // a dark colour is a light→dark pair for the whole SVG: on a token colour it would recolour everything else in that colour too
    for (const k of TONE_COLOR_KEYS) if (o.dark?.[k] && LIGHT_COLORS.has(o[k] ?? '')) throw new Error(`${where}.${name}.${k} ${o[k]} is a built-in colour (its dark colour is fixed); pick another light colour to give it dark.${k}`);
    out[name as ToneName] = o;
  }
  return out;
}
/** The project's tones with a diagram's own on top, colour by colour. */
export function mergeTones(base: ToneOverrides | undefined, own: ToneOverrides | undefined): ToneOverrides | undefined {
  if (!base) return own;
  if (!own) return base;
  const out: ToneOverrides = {...base};
  for (const [n, o] of Object.entries(own) as [ToneName, ToneOverride][]) out[n] = {...base[n], ...o, ...(base[n]?.dark || o.dark ? {dark: {...base[n]?.dark, ...o.dark}} : {})};
  return out;
}
function resolveTones(ov: ToneOverrides): ToneEnv {
  const styles: Partial<Record<ToneName, ToneStyle>> = {}, pairs: Record<string, string> = {}, colors: string[] = [];
  for (const [name, o] of Object.entries(ov) as [ToneName, ToneOverride][]) {
    const s: ToneStyle = {...TONES[name]};
    for (const k of TONE_COLOR_KEYS) {
      const c = o[k];
      if (!c) continue;
      (s as unknown as Record<string, string>)[k] = c;
      if (k === 'stroke') delete s.slideStroke; // the override is the outline in the slide decks too
      colors.push(c);
      const dk = o.dark?.[k];
      if (dk && pairs[c] && pairs[c] !== dk) throw new Error(`tones: ${c} is given two dark colours (${pairs[c]} and ${dk}); one light colour has one dark colour`);
      if (dk) { pairs[c] = dk; colors.push(dk); }
    }
    styles[name] = s;
  }
  return {styles, pairs, colors, merged: new Map()};
}
const ENVS = new WeakMap<object, ToneEnv>(); // keyed by the overrides object itself: the copies a pass makes of a diagram share its `tones`
/** The resolved tone overrides of a diagram (an empty or missing set is NO_TONES). The same object gives the same env. */
export function toneEnv(ov: ToneOverrides | undefined): ToneEnv {
  if (!ov || !Object.keys(ov).length) return NO_TONES;
  let env = ENVS.get(ov);
  if (!env) { env = resolveTones(ov); ENVS.set(ov, env); }
  return env;
}
/** Every colour the overrides use, light and dark (lint-svg reads them from the root's data-tone-colors). */
export const toneColors = (env: ToneEnv): readonly string[] => env.colors;
/** The colour key text in this tone uses ('text' unless the tone is one text can be set in). */
export const textKeyOf = (env: ToneEnv, tone: string | undefined): ColorKey => { const t = toneStyle(env, tone); return t.asText ? t.ink : 'text'; };
/** A filled emphasis tone: the box is an accent / danger fill, so its text is white unless a run says otherwise (it may not). */
export const isSolidTone = (tone: string | undefined): boolean => tone === 'solid' || tone === 'solid-danger';
/** The colour of a box's text run: `bg` (white) when the box is solid and the run has no tone of its own, else the run's tone. */
export function runColorOf(env: ToneEnv, runTone: TextTone | undefined, boxTone: string | undefined, theme: Theme): string {
  return isSolidTone(boxTone) && runTone === undefined ? colorOf(toneStyle(env, boxTone).text, theme) : textColorOf(env, runTone, theme);
}
/** A colour key resolved against a theme ('accent' and 'soft' are theme colours). */
export function colorOf(key: ColorKey, theme: Theme): string {
  if (key.startsWith('#')) return key;
  return key === 'accent' || key === 'soft' ? PALETTE[theme][key] : PALETTE[key as PlainColorKey];
}
/** The colour of a TextTone (a text run, a connector line) in a theme. */
export const textColorOf = (env: ToneEnv, tone: TextTone | undefined, theme: Theme): string => colorOf(textKeyOf(env, tone), theme);

// Palette keys diagram() accepts: 1, 2 (legacy day numbers) or a theme name.
// Object.keys makes them strings ('1', '2', 'blue', ...); PALETTE[key] indexes the numeric keys identically.
export const THEMES = Object.entries(PALETTE).filter(([, v]) => typeof v === 'object' && v.accent).map(([k]) => k);
const THEME_KEYS = THEMES as unknown as Theme[];

// Flat set of every hex value PALETTE can resolve to — this is exactly what
// lint-svg.ts's off-token-color check validates fill/stroke against.
export const ALLOWED_COLORS: ReadonlySet<string> = new Set([
  PALETTE.bg, PALETTE.text, PALETTE.muted, PALETTE.border, PALETTE.code, PALETTE.danger,
  ...THEME_KEYS.flatMap(k => [PALETTE[k].accent, PALETTE[k].soft]),
]);
/** The built-in dark set's colours: allowed in a diagram that says it is dark (root data-appearance="dark"), not in a light one. */
export const DARK_COLORS: ReadonlySet<string> = new Set(Object.values(DARK_OF));

export const FONT_STACKS: Record<'sans' | 'mono' | 'emoji', string> = {
  sans: `'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','YuGothic',Meiryo,'Noto Sans JP',sans-serif`,
  mono: `'JetBrains Mono','SF Mono','Menlo','Consolas','Liberation Mono','Courier New',monospace`,
  emoji: `'Noto Color Emoji','Segoe UI Emoji',sans-serif`,
};

export const MIN_FONT_SIZE = 14;
/** The lowest `canvas.minText` a diagram may declare (px): for a dense canvas figure read 1:1 on screen or paper, never projected (ADR 0017). */
export const MIN_TEXT_ABSOLUTE = 10;
/** `value` as a `canvas.minText` / `fontFloor`: a finite number from MIN_TEXT_ABSOLUTE up. Throws with `what` named. */
export function checkMinText(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < MIN_TEXT_ABSOLUTE) throw new Error(`${what} must be a number >= ${MIN_TEXT_ABSOLUTE} (got ${JSON.stringify(value)})`);
  return value;
}

/** The roles an opt-in text size (banner headlineRole, bars / plane labelRole) may name. */
export const HEADLINE_ROLES = ['banner', 'stat', 'display'] as const;
export const LABEL_ROLES = ['note', 'banner', 'stat'] as const;
/** What fill: true may scale an opted-in text size up to (px). The usual roles are scaled by up to 1.8 without this limit. */
export const OPT_IN_TEXT_MAX = 72;

// font-size (px) per semantic role. Every value is >= MIN_FONT_SIZE by
// construction — the DSL's normal box()/caption()/banner() path never lets a
// caller pick a raw px number outside this table.
export const ROLES: Roles = Object.freeze({
  title: 15, label: 14, body: 14, note: 14, banner: 16, stat: 34, display: 56,
});
/** `base` with every size scaled by `s` and rounded (fill: true). Pure: ROLES itself never changes. */
export function scaleRoles(base: Roles, s: number): Roles {
  return Object.freeze(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round(v * s)])) as Record<Role, number>);
}

/** diagram({canvas: 'slide'}): a 16:9 slide drawn 1:1; no text below `minText`. */
export const SLIDE_CANVAS = {width: 1280, height: 720, minText: 24};
/** The scale at which the smallest text (a role or a fixed size) becomes `minText`. */
export function canvasFontScale(minText: number): number {
  return Math.ceil(minText / Math.min(...Object.values(ROLES), 14) * 100) / 100;
}
/** What a stat() value may shrink to at scale 1 (px): ADR 0024 D4 (the slide canvas's minText, about 1.7x the 14px label). */
export const STAT_FIT_MIN = 24;
/**
 * The smallest size a stat() value is shrunk to when it does not fit its box (ADR 0024 D4): `round(24 x s)`, never above `size` (then it
 * is not shrunk). `s` is the scale `roles` were made at (read from the stat role: a canvas / fill diagram scales every role by it).
 * `minText`, when given, is a floor under that (a canvas's declared minimum; the smallest role of a canvas is already about it).
 */
export function statFitMin(roles: Roles, size: number, minText = 0): number {
  const s = roles.stat / ROLES.stat;
  return Math.min(size, Math.max(Math.round(STAT_FIT_MIN * s), minText));
}
/** The roles a canvas diagram is drawn with: every role and the fixed sizes (connector label, tag) scaled by `s`. */
export function canvasRoles(s: number): Roles {
  return Object.freeze({...scaleRoles(ROLES, s), connectLabel: Math.round(CONNECT_LABEL_SIZE * s), tag: Math.round(TAG_SIZE * s)});
}

/** The roles a figure is drawn with at font scale `s`: a canvas diagram's (canvasRoles), else ROLES scaled. The one place that chooses, so a renderer need not import ROLES. */
export function rolesAt(canvas: boolean, s: number): Roles {
  return canvas ? canvasRoles(s) : scaleRoles(ROLES, s);
}

// Fixed sizes of text that is not a role: the label on a connector line and the tag pill on a box.
// layout.ts measures with these and emit.ts draws with them, so they are defined once, here.
export const CONNECT_LABEL_SIZE = 14;
// connect({weight: 'strong'}): line width, and its arrowhead (userSpaceOnUse: a head scaled by the width would bite into the box).
export const STRONG_STROKE = 5, STRONG_HEAD = 16, STRONG_HEAD_REF_X = 6;
// how far the line stops short of the box edge so the head's tip lands on it (the line must end where the head is wider than the line)
export const STRONG_TRIM = (10 - STRONG_HEAD_REF_X) * STRONG_HEAD / 10;
export const TAG_SIZE = 14;

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
export function bestTextColor(bgLuminance: number, paint: (hex: string) => string = h => h): string {
  // judged on the colours as drawn (paint: the appearance's mapper); the light token is returned, to be recoloured with the rest
  const whiteDelta = Math.abs(luminance(paint('#ffffff')) - bgLuminance);
  const textDelta = Math.abs(luminance(paint(PALETTE.text)) - bgLuminance);
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
