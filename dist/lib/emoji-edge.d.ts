import type { TextBoxFn } from './svg-geom.ts';
import type { FontFamily } from './types/core.ts';
import type { WebMeasurer } from './web.ts';
/** The width of one emoji, in sizes: the system emoji fonts advance about 1.2 to 1.3 em. Room for the wider. */
export declare const EMOJI_EM = 1.25;
/** Whether the font has a glyph for a code point (OutlineFont.covers for one family and weight). */
export type Covers = (codePoint: number) => boolean;
/**
 * `text` cut into emoji and the runs between them, in order. An emoji is a pictograph cluster the font cannot draw (`covers`): one it
 * has (a ✓, a ★ in the CJK font) is text like any other. With no `covers`, every pictograph is an emoji.
 */
export declare function emojiParts(text: string, covers?: Covers): {
    s: string;
    emoji: boolean;
}[];
/** A measurer that gives each emoji (one `covers` says the font lacks) EMOJI_EM of the size and measures the rest with `measure`. */
export declare function emojiMeasurer(measure: WebMeasurer, covers: (codePoint: number, family: FontFamily, weight: number) => boolean): WebMeasurer;
/** A text box function that gives each emoji (one `covers` says the font lacks) EMOJI_EM of the size and measures the rest with `box`. */
export declare function emojiTextBox(box: TextBoxFn, covers: (codePoint: number, family: FontFamily, weight: number) => boolean): TextBoxFn;
