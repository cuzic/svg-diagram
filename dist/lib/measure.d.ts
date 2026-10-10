import type { Browser } from 'playwright-chromium';
import type { FontFamily, MeasureRequest, Measured, WidthOf } from './types.ts';
export declare function splitAtoms(text: string): string[];
/** Width of single-line text: the sum of its atoms' measured widths. The one place this sum is written. */
export declare function textWidth(widthOf: WidthOf, text: string, size: number, weight: number, font?: FontFamily): number;
declare function getBrowser(): Promise<Browser>;
export { getBrowser };
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
/**
 * Draw `svg` the way a page's <img src="x.svg"> does — as an image document, parsed as XML, with this browser's fonts —
 * scaled by `scale`, on white. An SVG that is not well-formed XML fails to load as an <img>; that is reported here as an
 * error rather than drawn from a forgiving HTML parse. Reuses the measuring browser, so a .ts source costs no extra launch.
 */
export declare function rasterize(svg: string, { scale, png }?: {
    scale?: number;
    png?: boolean;
}): Promise<Raster>;
export declare function closeMeasurer(): Promise<void>;
export declare function measureAll(requests: Map<string, MeasureRequest>): Promise<Map<string, Measured>>;
export declare function measureAtoms(strings: Iterable<string>, { size, weight, font }: {
    size: number;
    weight?: number;
    font?: FontFamily;
}): Promise<{
    width: (atom: string) => number;
    height: (atom: string) => number;
    raw: Map<string, Measured>;
}>;
