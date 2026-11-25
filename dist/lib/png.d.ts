import type { FontSpecs } from './types/project.ts';
/** The most pixels svgToPng() allocates: resvg's buffer is outside the JS heap, so a limit on the heap would not catch it. */
export declare const MAX_PNG_PIXELS = 64000000;
/** `svg` as a PNG, drawn by resvg with the given fonts. `scale` is above 0 and at most 4; a picture over MAX_PNG_PIXELS is refused before it is allocated. */
export declare function svgToPng(svg: string, opts?: {
    scale?: number;
    fonts?: FontSpecs;
}): Promise<{
    png: Buffer;
    width: number;
    height: number;
}>;
