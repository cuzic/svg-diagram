import type { ColorKey, Palette, Roles, Theme, TextTone, Appearance } from './types/core.ts';
export declare const PALETTE: Palette;
export declare const DARK_PALETTE: {
    readonly bg: '#1b1a17';
    readonly text: '#ece6da';
    readonly muted: '#a79e8e';
    readonly border: '#4a443a';
    readonly code: '#24221e';
    readonly danger: '#f05252';
    readonly amber: {
        readonly accent: '#e0a066';
        readonly soft: '#3b2f22';
    };
    readonly teal: {
        readonly accent: '#5fc1c6';
        readonly soft: '#1f3a3b';
    };
    readonly blue: {
        readonly accent: '#7ab2ee';
        readonly soft: '#1f3350';
    };
};
/** Every light token hex (the keys of the light→dark map). */
export declare const LIGHT_COLORS: ReadonlySet<string>;
export declare function mapOf(env: ToneEnv, appearance: Appearance | undefined): Record<string, string> | null;
/** The colours a custom dark set adds to what a lint may see (lint-svg reads them from the root's data-palette). */
export declare const customColors: (appearance: Appearance | undefined) => string[];
/** A light token hex in the appearance's built-in set (a tone override's dark pair is not in it: see mapOf; anything that is not a token, such as a raw() colour, stays as it is). */
export declare const darkOf: (hex: string, appearance?: Appearance) => string;
/** The colour mapper of an appearance: dark recolours, light (or none) leaves colours alone. */
export declare const paintOf: (env: ToneEnv, appearance: Appearance | undefined) => ((hex: string) => string);
/** Recolour the colours of emitted SVG / HTML with the appearance's token set. Only colour-bearing places are rewritten: the <style> CSS,
 *  and the fill / stroke / stop-color / flood-color / color / style / data-assumed-bg attributes of a tag. Text content, <title>, <desc>,
 *  <metadata> and other attributes (aria-label ...) can say "#ffffff" and keep it. Once only: a custom colour may equal a light token. */
export declare const recolor: (env: ToneEnv, text: string, appearance: Appearance | undefined) => string;
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
export declare const TONES: Record<ToneName, ToneStyle>;
/** Wireframe spellings of a tone: ok = accent, warn = danger, off = muted. */
export declare const TONE_ALIAS: Record<string, ToneName>;
/** The style of a tone name (aliases resolved; an unknown or missing tone is 'plain'). */
export declare function toneStyle(env: ToneEnv, tone: string | undefined): ToneStyle;
export type ToneColorKey = 'fill' | 'stroke' | 'text' | 'ink';
export type ToneColors = Partial<Record<ToneColorKey, string>>;
/** One tone's replacement colours (#rrggbb). `dark` is what the same colour becomes under appearance 'dark' (unset: it stays as is). */
export interface ToneOverride extends ToneColors {
    dark?: ToneColors;
}
export type ToneOverrides = Partial<Record<ToneName, ToneOverride>>;
/** The tone overrides of one diagram, resolved: the styles they change, the light→dark pairs, and every colour used. `merged` caches mapOf's table per base table. */
export interface ToneEnv {
    readonly styles: Readonly<Partial<Record<ToneName, ToneStyle>>>;
    readonly pairs: Readonly<Record<string, string>>;
    readonly colors: readonly string[];
    readonly merged: Map<Record<string, string>, Record<string, string>>;
}
/** No overrides: the built-in tones. */
export declare const NO_TONES: ToneEnv;
/** Validate a `tones` value (a diagram option or the config's): tone names must exist, colours are #rrggbb. Returns it normalised (lower-case hex). */
export declare function checkTones(input: unknown, where: string): ToneOverrides;
/** The project's tones with a diagram's own on top, colour by colour. */
export declare function mergeTones(base: ToneOverrides | undefined, own: ToneOverrides | undefined): ToneOverrides | undefined;
/** The resolved tone overrides of a diagram (an empty or missing set is NO_TONES). The same object gives the same env. */
export declare function toneEnv(ov: ToneOverrides | undefined): ToneEnv;
/** Every colour the overrides use, light and dark (lint-svg reads them from the root's data-tone-colors). */
export declare const toneColors: (env: ToneEnv) => readonly string[];
/** The colour key text in this tone uses ('text' unless the tone is one text can be set in). */
export declare const textKeyOf: (env: ToneEnv, tone: string | undefined) => ColorKey;
/** A filled emphasis tone: the box is an accent / danger fill, so its text is white unless a run says otherwise (it may not). */
export declare const isSolidTone: (tone: string | undefined) => boolean;
/** The colour of a box's text run: `bg` (white) when the box is solid and the run has no tone of its own, else the run's tone. */
export declare function runColorOf(env: ToneEnv, runTone: TextTone | undefined, boxTone: string | undefined, theme: Theme): string;
/** A colour key resolved against a theme ('accent' and 'soft' are theme colours). */
export declare function colorOf(key: ColorKey, theme: Theme): string;
/** The colour of a TextTone (a text run, a connector line) in a theme. */
export declare const textColorOf: (env: ToneEnv, tone: TextTone | undefined, theme: Theme) => string;
export declare const THEMES: string[];
export declare const ALLOWED_COLORS: ReadonlySet<string>;
/** The built-in dark set's colours: allowed in a diagram that says it is dark (root data-appearance="dark"), not in a light one. */
export declare const DARK_COLORS: ReadonlySet<string>;
export declare const FONT_STACKS: Record<'sans' | 'mono' | 'emoji', string>;
export declare const MIN_FONT_SIZE = 14;
/** The lowest `canvas.minText` a diagram may declare (px): for a dense canvas figure read 1:1 on screen or paper, never projected (ADR 0017). */
export declare const MIN_TEXT_ABSOLUTE = 10;
/** `value` as a `canvas.minText` / `fontFloor`: a finite number from MIN_TEXT_ABSOLUTE up. Throws with `what` named. */
export declare function checkMinText(value: unknown, what: string): number;
/** The roles an opt-in text size (banner headlineRole, bars / plane labelRole) may name. */
export declare const HEADLINE_ROLES: readonly ['banner', 'stat', 'display'];
export declare const LABEL_ROLES: readonly ['note', 'banner', 'stat'];
/** What fill: true may scale an opted-in text size up to (px). The usual roles are scaled by up to 1.8 without this limit. */
export declare const OPT_IN_TEXT_MAX = 72;
export declare const ROLES: Roles;
/** `base` with every size scaled by `s` and rounded (fill: true). Pure: ROLES itself never changes. */
export declare function scaleRoles(base: Roles, s: number): Roles;
/** diagram({canvas: 'slide'}): a 16:9 slide drawn 1:1; no text below `minText`. */
export declare const SLIDE_CANVAS: {
    width: number;
    height: number;
    minText: number;
};
/** The scale at which the smallest text (a role or a fixed size) becomes `minText`. */
export declare function canvasFontScale(minText: number): number;
/** What a stat() value may shrink to at scale 1 (px): ADR 0024 D4 (the slide canvas's minText, about 1.7x the 14px label). */
export declare const STAT_FIT_MIN = 24;
/**
 * The smallest size a stat() value is shrunk to when it does not fit its box (ADR 0024 D4): `round(24 x s)`, never above `size` (then it
 * is not shrunk). `s` is the scale `roles` were made at (read from the stat role: a canvas / fill diagram scales every role by it).
 * `minText`, when given, is a floor under that (a canvas's declared minimum; the smallest role of a canvas is already about it).
 */
export declare function statFitMin(roles: Roles, size: number, minText?: number): number;
/** The roles a canvas diagram is drawn with: every role and the fixed sizes (connector label, tag) scaled by `s`. */
export declare function canvasRoles(s: number): Roles;
/** The roles a figure is drawn with at font scale `s`: a canvas diagram's (canvasRoles), else ROLES scaled. The one place that chooses, so a renderer need not import ROLES. */
export declare function rolesAt(canvas: boolean, s: number): Roles;
export declare const CONNECT_LABEL_SIZE = 14;
export declare const STRONG_STROKE = 5, STRONG_HEAD = 16, STRONG_HEAD_REF_X = 6;
export declare const STRONG_TRIM: number;
export declare const TAG_SIZE = 14;
export declare const CELL_MARKS: Record<'ok' | 'mid' | 'ng' | 'best', {
    glyph: string;
    tone: 'text' | 'accent' | 'danger';
    bold: boolean;
}>;
export declare const SHADES: number[];
export declare const EMOJI_RE: RegExp;
export declare function luminance(hex: string): number;
export declare function blendLuminance(baseHex: string, overlayHex: string, alpha: number): number;
export declare function bestTextColor(bgLuminance: number, paint?: (hex: string) => string): string;
export declare function relativeLuminance(hex: string): number;
export declare function wcagRatio(a: string, b: string): number;
