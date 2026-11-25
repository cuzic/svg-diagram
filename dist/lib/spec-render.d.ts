import { lintMessages } from './spec-result.ts';
import type { RenderSpecResult } from './spec-result.ts';
import type { Config } from './types/project.ts';
export type { RenderChecks } from './geometry-checks.ts';
export { lintRendering, MAX_FIGURE_HEIGHT } from './spec-node-result.ts';
export { MAX_PNG_PIXELS, svgToPng } from './png.ts';
export { lintMessages };
export type { RenderSpecResult };
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
