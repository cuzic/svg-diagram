import {guardedEngine, MAX_EDGE_HEIGHT, TextEngineError, type TextEngine} from './spec-edge-core.ts';
import {noPptx, outlinePptxPictures, zipPackage, type PptxEdgeOptions, type PptxEdgeResult, type FigurePlan} from './pptx-edge-core.ts';
import {growParts} from './flow-grow.ts';
import {prepareSpecLayout, SpecError} from './spec-selective.ts';
import type {SpecIssue} from './spec-kit.ts';
import {layoutIssue} from './spec-result.ts';
import {packageEntries} from './pptx/package.ts';
import {planPreparedPptx, type SelectiveSlideOptions} from './pptx/selective.ts';

export {TextEngineError, type TextEngine} from './spec-edge-core.ts';

export type SelectedFigureOptions = Parameters<typeof prepareSpecLayout>[1] & SelectiveSlideOptions & Pick<PptxEdgeOptions, 'maxHeight'>;
type Options = SelectedFigureOptions & PptxEdgeOptions;

/** `width`: the deck's layout width past the spec's 940 (a wide slide room, B6); not an option, so a caller's or a figure's own width is never overridden. */
export async function planSelectedFigureEdge(spec: unknown, engine: TextEngine, opts: SelectedFigureOptions, wide?: number, textSize?: number): Promise<FigurePlan | {issues: SpecIssue[]}> {
  let prepared: Awaited<ReturnType<ReturnType<typeof prepareSpecLayout>>>;
  try { prepared = await prepareSpecLayout(spec, textSize === undefined ? opts : {...opts, parts: growParts(opts.parts, textSize)}, wide)(engine.measure); }
  catch (error) {
    if (error instanceof SpecError) return {issues: [...error.issues]};
    if (error instanceof TextEngineError) throw error;
    return {issues: [layoutIssue(spec, error)]};
  }
  const maxHeight = opts.maxHeight ?? MAX_EDGE_HEIGHT;
  if (prepared.placed.canvasHeight > maxHeight) {
    return {issues: [{path: '', message: `the figure is ${prepared.placed.canvasHeight}px tall; the limit is ${maxHeight}px`}]};
  }
  const {plan, native} = planPreparedPptx(prepared, {...opts, title: opts.title ?? prepared.placed.title});
  const issues = outlinePptxPictures(spec, plan, engine);
  if (issues.length) return {issues};
  const {width, canvasHeight} = prepared.placed;
  const {warnings, problems} = prepared.verdict;
  return {plan, native, width: Math.max(96, width), height: Math.max(96, canvasHeight), findings: [...warnings, ...problems], problems};
}

/** Draw a spec using only the selected parts and PPTX adapters in a portable runtime. */
export async function renderPptxEdge(spec: unknown, givenEngine: TextEngine, opts: Options): Promise<PptxEdgeResult> {
  const engine = guardedEngine(givenEngine);
  const pngScale = opts.pngScale ?? 2;
  if (!(Number.isFinite(pngScale) && pngScale > 0)) throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
  const figure = await planSelectedFigureEdge(spec, engine, opts);
  if ('issues' in figure) return noPptx(figure.issues);
  const {plan, native} = figure;
  const pngs: Uint8Array[] = [];
  for (const picture of plan.pictures) pngs.push(await opts.rasterize(picture.pngSvg, pngScale));
  return {pptx: await zipPackage(packageEntries(plan, pngs)), issues: [], native, pictures: plan.pictures.length};
}
