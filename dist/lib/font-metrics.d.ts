import * as hb from 'harfbuzzjs';
import type { FontFamily, MeasureRequest, Measured } from './types/core.ts';
import type { FontSpecs } from './types/project.ts';
/** The font that measures `emoji` (regular) as HarfBuzz objects, for reading its color glyphs (lib/emoji-color.ts); null when none can be found. */
export declare function emojiFontFace(specs?: FontSpecs): {
    face: hb.Face;
    font: hb.Font;
    upem: number;
    ascender: number;
    descender: number;
} | null;
/** The code points the font that measures `family` at this weight has a glyph for; null when none can be found. */
export declare function fontCoverage(family: FontFamily, weight?: number, specs?: FontSpecs): ReadonlySet<number> | null;
/** Whether the fonts that measure sans, mono and emoji between them have a glyph for every visible character of `text`. */
export declare function fontsCover(text: string, specs?: FontSpecs): boolean;
/** The font file (and face index, and the family name inside it) that measures `family` at this weight, or null when none can be found. */
export declare function resolveFontFile(family: FontFamily, weight?: number, specs?: FontSpecs): {
    file: string;
    index: number;
    name: string;
} | null;
/** The box Chromium gives a line of text at `size`: the font's ascent and descent, each rounded to a whole pixel, and the advance of `text`. */
export declare function textBox(text: string, family: FontFamily, size: number, weight?: number, specs?: FontSpecs): {
    w: number;
    ascent: number;
    descent: number;
};
/** The widths and heights measure.ts would get from Chromium, read from the font files. Synchronous: no browser. */
export declare function measureWithFonts(requests: Map<string, MeasureRequest>, specs?: FontSpecs): Map<string, Measured>;
