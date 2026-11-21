import { type TextBoxFn } from './svg-geom.ts';
import type { FontFamily } from './types/core.ts';
export interface ShapedGlyph {
    id: number;
    xAdvance: number;
    xOffset: number;
    yOffset: number;
}
/** The font the outlines come from. `shape` and `path` are in font units; the path is SVG path data with y up, as a font has it. */
export interface OutlineFont {
    shape(text: string, family: FontFamily, weight: number): {
        upem: number;
        glyphs: ShapedGlyph[];
    };
    path(id: number, family: FontFamily, weight: number): string;
    covers(codePoint: number, family: FontFamily, weight: number): boolean;
}
export interface Outlined {
    svg: string;
    /** Characters the font has no glyph for, with the text they are in. Those draw as the font's empty-box glyph. */
    missing: {
        text: string;
        char: string;
    }[];
    /** What a <text> asked for that outlines here do not reproduce. */
    unsupported: string[];
}
/**
 * `svg` with every <text> replaced by outlines of its glyphs. A glyph used twice is defined once. `liveEmoji`: an emoji the font has no
 * glyph for stays text (in the viewer's emoji font, EMOJI_EM of its size wide: measure with emojiTextBox), and is not missing.
 */
export declare function outlineText(svg: string, font: OutlineFont, measure: TextBoxFn, opts?: {
    liveEmoji?: boolean;
}): Outlined;
