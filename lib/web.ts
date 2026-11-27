// The entry for a web page ("svg-diagram/browser", ADR 0045): the builders of the package entry and renderInBrowser(), which draws a figure
// with the text measured by a function the page gives (ADR 0007's Ports: the Measurer is swapped). Nothing here reaches node:*, HarfBuzz,
// Chromium or a file, so a bundler takes it as it is (test/web-entry.test.ts bundles it for the browser with no alias or stub).
//
// Out of this entry: build() / renderDiagram() / checkDiagram() (they read files and the slide budget), diagram({slide, fill}) (the budget is
// measured in a real slide), math() and image() (they throw, saying so), and the HTML form. Path icons come only from icon.use(manifest).
import {captionDefinition} from './bands/caption.ts';
import {connectDefinition} from './bands/connect.ts';
import {autoLegend} from './bands/legend.ts';
import {detachData} from './dsl/diagram.ts';
import type {analyzeFit} from './fit.ts';
import {legacySpotlighter, renderLegacyDiagramWithCore} from './legacy-core.ts';
import {slideFitter} from './slide-fill.ts';
import {checkToday} from './today-auto.ts';
import type {Diagram, DiagramData, MeasureRequest, Measured} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {Verdict} from './types/verdicts.ts';
import {normalizeIdPrefix, prepareForEmbedding} from './svg-ids.ts';
import type {EmbedOptions} from './svg-ids.ts';

export * from './dsl-pure.ts';
export {canvasMeasurer, svgMeasurer} from './web-measure.ts';

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
  /** The laid-out figure the SVG was drawn from: what a writer for another format (the PPTX of ./pptx-edge.ts) starts from. */
  laidOut: LaidOutDiagram;
}

const unsupported = (what: string, why: string) => (..._args: unknown[]): never => { throw new Error(`${what} is not available in the browser entry (${why})`); };
/** math() needs MathJax through node:module; the browser entry has no formulas. */
export const math = unsupported('math()', 'TeX formulas are drawn by the Node entry only');
/** image() reads picture files; the browser entry has no file to read. */
export const image = unsupported('image()', 'pictures are read from files by the Node entry only');

/**
 * Lay out, verify and draw a diagram with the text measured by `measure` (use svgMeasurer()). Like renderDiagram() it does not throw for a
 * failed verification or a malformed SVG: both are in the result. A layout or build error still throws.
 * `today` ('YYYY-MM-DD'): the day a gantt({today: 'auto'}) draws; the library never reads the clock, so the page says which day it is.
 */
export async function renderInBrowser(input: Diagram | DiagramData, opts: {measure: WebMeasurer; today?: string; nodeIds?: boolean} & EmbedOptions): Promise<WebRender> {
  if (opts.idPrefix !== undefined) normalizeIdPrefix(opts.idPrefix);
  const d = detachData(opts.today === undefined ? input : {...input, today: checkToday(opts.today, 'renderInBrowser({today})')});
  if (d.slide || d.fill) throw new Error('renderInBrowser: diagram({slide, fill}) needs a measured slide, which the browser entry has not got');
  // The supplied engine runs in the page, without launching a separate browser.
  d.measure ??= {backend: 'font', explicit: false};
  const {svg, verdict, xml, width, height, fit, fontScale, laidOut} = await renderLegacyDiagramWithCore(
    d, {measure: opts.measure, nodeIds: opts.nodeIds},
    {spotlighter: legacySpotlighter, fitter: slideFitter, connectors: connectDefinition, captions: captionDefinition, autoLegend},
  );
  return {svg: prepareForEmbedding(svg, opts), verdict, xml, width, height, fit, fontScale, laidOut};
}

export {renderComic} from './comic/render.ts';
export type {ComicRender} from './comic/render.ts';
export {renderChat} from './chat/render.ts';
export type {ChatRender} from './chat/render.ts';
