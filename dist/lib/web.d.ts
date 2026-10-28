import { analyzeFit } from './fit.ts';
import type { Diagram, DiagramData, MeasureRequest, Measured } from './types/core.ts';
import type { Verdict } from './types/verdicts.ts';
export * from './dsl-pure.ts';
export { canvasMeasurer, svgMeasurer } from './web-measure.ts';
/** Measures one run of text: the width and the line height the page's own text engine gives (see svgMeasurer). Calls can overlap: the runs of one layout are asked together, so an async measurer must not share state between them. */
export type WebMeasurer = (req: Required<MeasureRequest>) => Measured | Promise<Measured>;
export interface WebRender {
    svg: string;
    verdict: Verdict;
    /** XML well-formedness problems of the SVG (empty when it parses). */
    xml: string[];
    width: number;
    height: number;
    /** How the figure sits at its display size (small text, tall slide figures), as in renderDiagram(). */
    fit: ReturnType<typeof analyzeFit>;
    /** The font scale a canvas figure was drawn at (1 otherwise). */
    fontScale: number;
}
/** math() needs MathJax through node:module; the browser entry has no formulas. */
export declare const math: (..._args: unknown[]) => never;
/** image() reads picture files; the browser entry has no file to read. */
export declare const image: (..._args: unknown[]) => never;
/**
 * Lay out, verify and draw a diagram with the text measured by `measure` (use svgMeasurer()). Like renderDiagram() it does not throw for a
 * failed verification or a malformed SVG: both are in the result. A layout or build error still throws.
 * `today` ('YYYY-MM-DD'): the day a gantt({today: 'auto'}) draws; the library never reads the clock, so the page says which day it is.
 */
export declare function renderInBrowser(input: Diagram | DiagramData, opts: {
    measure: WebMeasurer;
    today?: string;
    nodeIds?: boolean;
}): Promise<WebRender>;
