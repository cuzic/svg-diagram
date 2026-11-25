// The entry for a web page ("svg-diagram/browser", ADR 0045): the builders of the package entry and renderInBrowser(), which draws a figure
// with the text measured by a function the page gives (ADR 0007's Ports: the Measurer is swapped). Nothing here reaches node:*, HarfBuzz,
// Chromium or a file, so a bundler takes it as it is (test/web-entry.test.ts bundles it for the browser with no alias or stub).
//
// Out of this entry: build() / renderDiagram() / checkDiagram() (they read files and the slide budget), diagram({slide, fill}) (the budget is
// measured in a real slide), math() and image() (they throw, saying so), and the HTML form. Path icons come only from icon.use(manifest).
import { captionDefinition } from './bands/caption.js';
import { connectDefinition } from './bands/connect.js';
import { autoLegend } from './bands/legend.js';
import { detachData } from './dsl/diagram.js';
import { legacySpotlighter, renderLegacyDiagramWithCore } from './legacy-core.js';
import { slideFitter } from './slide-fill.js';
import { checkToday } from './today-auto.js';
export * from './dsl-pure.js';
export { canvasMeasurer, svgMeasurer } from './web-measure.js';
const unsupported = (what, why) => (..._args) => { throw new Error(`${what} is not available in the browser entry (${why})`); };
/** math() needs MathJax through node:module; the browser entry has no formulas. */
export const math = unsupported('math()', 'TeX formulas are drawn by the Node entry only');
/** image() reads picture files; the browser entry has no file to read. */
export const image = unsupported('image()', 'pictures are read from files by the Node entry only');
/**
 * Lay out, verify and draw a diagram with the text measured by `measure` (use svgMeasurer()). Like renderDiagram() it does not throw for a
 * failed verification or a malformed SVG: both are in the result. A layout or build error still throws.
 * `today` ('YYYY-MM-DD'): the day a gantt({today: 'auto'}) draws; the library never reads the clock, so the page says which day it is.
 */
export async function renderInBrowser(input, opts) {
    const d = detachData(opts.today === undefined ? input : { ...input, today: checkToday(opts.today, 'renderInBrowser({today})') });
    if (d.slide || d.fill)
        throw new Error('renderInBrowser: diagram({slide, fill}) needs a measured slide, which the browser entry has not got');
    // The supplied engine runs in the page, without launching a separate browser.
    d.measure ??= { backend: 'font', explicit: false };
    const { svg, verdict, xml, width, height, fit, fontScale, laidOut } = await renderLegacyDiagramWithCore(d, { measure: opts.measure, nodeIds: opts.nodeIds }, { spotlighter: legacySpotlighter, fitter: slideFitter, connectors: connectDefinition, captions: captionDefinition, autoLegend });
    return { svg, verdict, xml, width, height, fit, fontScale, laidOut };
}
export { renderComic } from './comic/render.js';
