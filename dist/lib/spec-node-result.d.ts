import { type RenderChecks } from './geometry-checks.ts';
import type { RenderSpecResult } from './spec-result.ts';
import type { SpecIssue } from './spec-kit.ts';
import type { FontSpecs } from './types/project.ts';
import type { RenderResult } from './types/verdicts.ts';
/** The tallest figure renderSpec() returns by default. */
export declare const MAX_FIGURE_HEIGHT = 8000;
/** The five checks on a drawn SVG (contrast, past the canvas, text over text, text out of its box, a shape over a text), from the SVG's own geometry; no file, no browser. null when `svg` has no <svg>. The colour-token and font-size rules of `svg-diagram lint` are not here. */
export declare function lintRendering(svg: string, opts?: {
    fonts?: FontSpecs;
}): RenderChecks | null;
export declare const nothing: (issues: SpecIssue[]) => RenderSpecResult;
/** A failure of this machine (a font file, the browser), as opposed to a figure that cannot be drawn: telling the caller to change the spec would be wrong. */
export declare const isInfrastructure: (e: unknown) => boolean;
export declare function finishNodeSpec(spec: unknown, r: Pick<RenderResult, 'width' | 'height' | 'svg' | 'verdict' | 'xml'>, maxHeight: number, fonts?: FontSpecs): RenderSpecResult;
