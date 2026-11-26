// A JSON spec as a one-slide PowerPoint file, where there is no file system and no native code, such as a Cloudflare Worker
// ("svg-diagram/pptx/edge"). The same writer as `svg-diagram pptx` (ADR 0027): boxes, tables and connectors become native shapes, the
// other bands pictures (SVG with a PNG fallback). What the Node shell does with resvg and node:zlib is the caller's here: it hands in the
// text engine (as for renderSpecEdge) and a function that turns an SVG into a PNG. The pictures' text is turned into outlines first, so
// neither the PNG nor the SVG depends on fonts.
import {renderInBrowser, type WebRender} from './web.ts';
import {SpecError, layoutIssue, specToDiagram, type SpecIssue} from './spec.ts';
import {MAX_EDGE_HEIGHT, TextEngineError, guardedEngine, type TextEngine} from './spec-edge.ts';
import {planSlide, fontsOf} from './pptx/slide.ts';
import {packageEntries} from './pptx/package.ts';
import {noPptx, outlinePptxPictures, zipPackage, type PptxEdgeOptions, type PptxEdgeResult, type FigurePlan} from './pptx-edge-core.ts';
import type {Diagram} from './types/core.ts';

export {zipPackage, type PptxEdgeOptions, type PptxEdgeResult, type FigurePlan} from './pptx-edge-core.ts';

export type {TextEngine} from './spec-edge.ts';
export {TextEngineError} from './spec-edge.ts';

/** The spec as a slide plan, or the issues that stop it (with their places in the spec). Throws TextEngineError as renderPptxEdge does. */
export async function planFigureEdge(spec: unknown, engine: TextEngine, opts: {font?: string; maxHeight?: number} = {}): Promise<FigurePlan | {issues: SpecIssue[]}> {
  let d: Diagram;
  try { d = specToDiagram(spec); }
  catch (e) {
    if (e instanceof SpecError) return {issues: [...e.issues]};
    throw e;
  }
  let r: WebRender;
  try { r = await renderInBrowser(d, {measure: engine.measure}); }
  catch (e) {
    if (e instanceof TextEngineError) throw e;
    return {issues: [layoutIssue(spec, e)]};
  }
  const maxHeight = opts.maxHeight ?? MAX_EDGE_HEIGHT;
  if (r.height > maxHeight) return {issues: [{path: '', message: `the figure is ${r.height}px tall; the limit is ${maxHeight}px`}]};
  const plan = planSlide(r.laidOut, fontsOf(opts.font));
  const missing = outlinePptxPictures(spec, plan, engine);
  if (missing.length) return {issues: missing};
  return {plan, width: Math.max(96, r.laidOut.width), height: Math.max(96, r.laidOut.canvasHeight), native: r.laidOut.laidOut.length - plan.pictures.length, findings: [...r.verdict.warnings, ...r.verdict.problems], problems: r.verdict.problems};
}

/**
 * The spec as a .pptx. A bad spec or a figure that cannot be laid out comes back as issues; a failure of the engine that was handed in
 * throws TextEngineError, and one of `rasterize` throws as it is. The drawing's own checks are renderSpecEdge's: run that first.
 */
export async function renderPptxEdge(spec: unknown, givenEngine: TextEngine, opts: PptxEdgeOptions): Promise<PptxEdgeResult> {
  const engine = guardedEngine(givenEngine);
  const pngScale = opts.pngScale ?? 2;
  if (!(Number.isFinite(pngScale) && pngScale > 0)) throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
  const f = await planFigureEdge(spec, engine, opts);
  if ('issues' in f) return noPptx(f.issues);
  const pngs: Uint8Array[] = [];
  for (const p of f.plan.pictures) pngs.push(await opts.rasterize(p.pngSvg, pngScale));
  return {pptx: await zipPackage(packageEntries(f.plan, pngs)), issues: [], native: f.native, pictures: f.plan.pictures.length};
}
