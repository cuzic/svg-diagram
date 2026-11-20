import type * as HB from 'harfbuzzjs';
import type { FontFamily, MeasureRequest, Measured } from './types/core.ts';
import type { FontSpecs } from './types/project.ts';
import type { OutlineFont } from './svg-outline.ts';
export declare function harfbuzz(): typeof HB;
/** Whether the font files can be read at all (HarfBuzz is installed). */
export declare const hasHarfbuzz: boolean;
/** The font that measures `emoji` (regular) as HarfBuzz objects, for reading its color glyphs (lib/emoji-color.ts); null when none can be found. */
export declare function emojiFontFace(specs?: FontSpecs): {
    face: HB.Face;
    font: HB.Font;
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
/**
 * The font files as the outlines of `serve`'s slides (ADR 0056 D2): the same file per family and weight as the measuring above, the same
 * `wght`, and a glyph the primary font lacks taken from the same fallbacks in the same order (a color font is left out: its glyphs are
 * pictures, not outlines, so such a character stays live text). A fallback's glyph is scaled to the primary font's units, and its id
 * carries which font it is from (outlineText keys glyphs by family, weight and id).
 */
export declare function outlineFontFromFiles(specs?: FontSpecs): OutlineFont;
/** Every font file the slides of a project would be outlined with, or what is missing (ADR 0056 D2: `serve` stops at once rather than draw boxes). */
export declare function outlineFontCheck(specs?: FontSpecs): {
    ok: true;
    files: string[];
} | {
    ok: false;
    missing: string[];
};
