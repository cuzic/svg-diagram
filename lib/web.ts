// The entry for a web page ("svg-diagram/browser", ADR 0045): the builders of the package entry and renderInBrowser(), which draws a figure
// with the text measured by a function the page gives (ADR 0007's Ports: the Measurer is swapped). Nothing here reaches node:*, HarfBuzz,
// Chromium or a file, so a bundler takes it as it is (test/web-entry.test.ts bundles it for the browser with no alias or stub).
//
// Out of this entry: build() / renderDiagram() / checkDiagram() (they read files and the slide budget), diagram({slide, fill}) (the budget is
// measured in a real slide), math() and image() (they throw, saying so), and the HTML form. Path icons come only from icon.use(manifest).
import {collectMeasures, widthOfMeasured} from './layout-measure.ts';
import {layoutWith} from './layout.ts';
import {emitOutputs, runChecked} from './pipeline.ts';
import {canvasFontScale, canvasRoles, ROLES, scaleRoles} from './tokens.ts';
import {detachData, layoutFitted} from './dsl/diagram.ts';
import type {Diagram, DiagramData, MeasureRequest, Measured, Roles} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {Verdict} from './types/verdicts.ts';

export * from './dsl-pure.ts';
export {canvasMeasurer} from './web-measure.ts';

/** Measures one run of text: the width and the line height the page's own text engine gives (see canvasMeasurer). */
export type WebMeasurer = (req: Required<MeasureRequest>) => Measured | Promise<Measured>;

export interface WebRender {
  svg: string;
  verdict: Verdict;
  /** XML well-formedness problems of the SVG (empty when it parses). */
  xml: string[];
  width: number;
  height: number;
}

const unsupported = (what: string, why: string) => (..._args: unknown[]): never => { throw new Error(`${what} is not available in the browser entry (${why})`); };
/** math() needs MathJax through node:module; the browser entry has no formulas. */
export const math = unsupported('math()', 'TeX formulas are drawn by the Node entry only');
/** image() reads picture files; the browser entry has no file to read. */
export const image = unsupported('image()', 'pictures are read from files by the Node entry only');

/**
 * Lay out, verify and draw a diagram with the text measured by `measure`. Like renderDiagram() it does not throw for a failed verification
 * or a malformed SVG: both are in the result. A layout or build error still throws.
 */
export async function renderInBrowser(input: Diagram | DiagramData, opts: {measure: WebMeasurer; nodeIds?: boolean}): Promise<WebRender> {
  const d = detachData(input);
  if (d.slide || d.fill) throw new Error('renderInBrowser: diagram({slide, fill}) needs a measured slide, which the browser entry has not got');
  const layoutAt = async (roles: Roles, pad: number, gap: number): Promise<LaidOutDiagram> => {
    const data: DiagramData = {...d, pad, gap};
    const reqs = collectMeasures(data, roles);
    const measured = new Map<string, Measured>();
    for (const [key, r] of reqs) measured.set(key, await opts.measure({text: r.text, size: r.size, weight: r.weight ?? 400, font: r.font ?? 'sans'}));
    return {...layoutWith(data, roles, widthOfMeasured(measured, false)), measure: d.measure ?? {backend: 'chromium', explicit: false}};
  };
  // a whole-slide canvas is drawn 1:1, so everything is scaled until the smallest text is the canvas's minimum (as renderDiagram does)
  const s = d.canvas ? canvasFontScale(d.canvas.minText) : 1;
  const {laidOut, verdict} = await runChecked(d, prepared => layoutFitted(prepared, () => d.canvas
    ? layoutAt(canvasRoles(s), Math.round(prepared.pad * s), Math.round(prepared.gap * s))
    : layoutAt(s === 1 ? ROLES : scaleRoles(ROLES, s), prepared.pad, prepared.gap)));
  const emitted = emitOutputs(laidOut, {reveal: d.maxReveal, ...(opts.nodeIds ? {nodeIds: true} : {})});
  return {svg: emitted.svg, verdict, xml: emitted.xml, width: laidOut.width, height: laidOut.canvasHeight};
}
