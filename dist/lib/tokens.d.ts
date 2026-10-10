import type { ColorKey, Palette, Role, Theme, TextTone } from './types.ts';
export declare const PALETTE: Palette;
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
export declare function toneStyle(tone: string | undefined): ToneStyle;
/** The colour key text in this tone uses ('text' unless the tone is one text can be set in). */
export declare const textKeyOf: (tone: string | undefined) => ColorKey;
/** A colour key resolved against a theme ('accent' and 'soft' are theme colours). */
export declare function colorOf(key: ColorKey, theme: Theme): string;
/** The colour of a TextTone (a text run, a connector line) in a theme. */
export declare const textColorOf: (tone: TextTone | undefined, theme: Theme) => string;
export declare const THEMES: string[];
export declare const ALLOWED_COLORS: Set<string>;
export declare const FONT_STACKS: Record<'sans' | 'mono' | 'emoji', string>;
export declare const MIN_FONT_SIZE = 14;
export declare const ROLES: Record<Role, number>;
export declare const CONNECT_LABEL_SIZE = 14;
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
export declare function bestTextColor(bgLuminance: number): string;
export declare function relativeLuminance(hex: string): number;
export declare function wcagRatio(a: string, b: string): number;
