import type { FontSpecs } from './types/project.ts';
export type RasterEngine = 'auto' | 'resvg' | 'chromium';
export interface Raster {
    width: number;
    height: number;
    /** RGBA, row-major, 4 bytes per pixel (what the sixel encoder takes). */
    rgba: Buffer;
    /** PNG of the same pixels, when asked for. */
    png?: Buffer;
}
/** The SVG's own width and height (the root's attributes, or its viewBox). */
export declare function svgSize(svg: string): {
    w: number;
    h: number;
} | null;
/** The SVG with everything it draws turned to grey (luma, as a mono print or a colour-blind reader sees it): the content goes inside a group filtered by a colour matrix.
 *  The filter region is the canvas in user units (the viewBox, with a margin), not the group's bounding box: a box-relative region is empty for content with no height (a lone horizontal line),
 *  which would drop it. Absolute numbers, not percentages: resvg panics on a userSpaceOnUse region in percent when the viewBox does not start at 0 0. */
export declare function grayscaleSvg(svg: string): string;
/** The SVG with a thin red band along its top edge saying `message` (ADR 0013: a PNG of an out-of-date figure shows it). Added just before the closing tag, so
 *  the band is drawn over the figure; the file on disk is not touched. Text is drawn with the sheet's own fonts: where there are none, the band is still there. */
export declare function staleBannerSvg(svg: string, message: string): string;
/** resvg points an `orient="auto-start-reverse"` end marker along the wrong segment at a corner (an elbow ending downward gets a sideways head), while `orient="auto"` is right.
 *  So each such marker becomes two for resvg: the same marker with `auto` (for marker-end / marker-mid), and a copy for marker-start whose content is turned 180 degrees about the ref point. */
export declare function resvgMarkers(svg: string): string;
export declare const NOT_LOADABLE = "a figure could not be drawn: @resvg/resvg-js could not be loaded on this machine (no prebuilt binary for it?).\n  Use the browser instead:  --engine chromium  (needs: pnpm add -D playwright-chromium)";
/**
 * What resvg draws this figure with. It parses every font it is given on every drawing and cannot keep them between drawings, which for a
 * 14 MB Japanese font is seconds; so it is given, per font the figure needs (sans, bold, mono, emoji: only those used), that font cut down to the
 * characters of the figure (lib/font-subset.ts). The pixels are the same. The system's fonts are read as well only when some character of the
 * figure has no glyph in the layout's fonts (resvg falls back per glyph; reading them costs seconds). Call `cleanup()` when the drawing is done:
 * the cut fonts are temporary files.
 */
export declare function prepareResvgFonts(svg: string, specs?: FontSpecs): {
    options: ResvgFontOptions;
    cleanup: () => void;
};
export interface ResvgFontOptions {
    fontFiles: string[];
    loadSystemFonts: boolean;
    defaultFontFamily?: string;
    sansSerifFamily?: string;
    monospaceFamily?: string;
}
export declare function rasterizeWithResvg(svg: string, { scale, png, fonts }?: {
    scale?: number;
    png?: boolean;
    fonts?: FontSpecs;
}): Promise<Raster>;
export declare function rasterize(svg: string, opts?: {
    scale?: number;
    png?: boolean;
    engine?: RasterEngine;
    fonts?: FontSpecs;
}): Promise<Raster>;
/**
 * `svg` as a nested <svg> element at (x, y), w × h, to put several figures into one SVG. Unlike an <image> of the file (whose
 * text resvg draws without any font), a nested element is drawn with the same fonts as the sheet. Ids are prefixed per figure so
 * that two figures that both define `id="arrow"` do not capture each other's references.
 */
export declare function embedSvg(svg: string, box: {
    x: number;
    y: number;
    w: number;
    h: number;
}, idPrefix: string): string;
