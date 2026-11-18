import { type RenderChecks } from './geometry-checks.ts';
import { lintMessages, type RenderSpecResult } from './spec.ts';
import type { Config, FontSpecs } from './types/project.ts';
export type { RenderChecks };
export { lintMessages };
export type { RenderSpecResult };
/** The tallest figure renderSpec() returns by default. */
export declare const MAX_FIGURE_HEIGHT = 8000;
/** The most pixels svgToPng() allocates: resvg's buffer is outside the JS heap, so a limit on the heap would not catch it. */
export declare const MAX_PNG_PIXELS = 64000000;
/** The five checks on a drawn SVG (contrast, past the canvas, text over text, text out of its box, a shape over a text), from the SVG's own geometry; no file, no browser. null when `svg` has no <svg>. The colour-token and font-size rules of `svg-diagram lint` are not here. */
export declare function lintRendering(svg: string, opts?: {
    fonts?: FontSpecs;
}): RenderChecks | null;
/** `svg` as a PNG, drawn by resvg with the given fonts. `scale` is above 0 and at most 4; a picture over MAX_PNG_PIXELS is refused before it is allocated. */
export declare function svgToPng(svg: string, opts?: {
    scale?: number;
    fonts?: FontSpecs;
}): Promise<{
    png: Buffer;
    width: number;
    height: number;
}>;
export interface RenderSpecOptions {
    /** Which fonts text is measured with. Default: the font lookup of this machine. */
    config?: Pick<Config, 'measure' | 'fonts'>;
    /** The name used in messages (default 'diagram.svg'). */
    name?: string;
    /** A taller figure is refused (default MAX_FIGURE_HEIGHT). */
    maxHeight?: number;
}
/**
 * Draw and check a spec. A bad spec, or a figure that does not fit, comes back in the result with its place. A failure of the machine itself
 * (a font file missing) throws. Layout is synchronous and can take seconds at the limits of the schema: a server should call this from a
 * worker with a time limit.
 */
export declare function renderSpec(spec: unknown, opts?: RenderSpecOptions): Promise<RenderSpecResult>;
