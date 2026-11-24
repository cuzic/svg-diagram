import {guardedEngine, MAX_EDGE_HEIGHT, TextEngineError, type TextEngine} from './spec-edge-core.ts';
import {noPptx, outlinePptxPictures, zipPackage, type PptxEdgeOptions, type PptxEdgeResult} from './pptx-edge-core.ts';
import {prepareSpecLayout, SpecError} from './spec-selective.ts';
import {layoutIssue} from './spec-result.ts';
import {packageEntries} from './pptx/package.ts';
import {planPreparedPptx, type SelectiveSlideOptions} from './pptx/selective.ts';

export {TextEngineError, type TextEngine} from './spec-edge-core.ts';

type Options = Parameters<typeof prepareSpecLayout>[1] & SelectiveSlideOptions & PptxEdgeOptions;

/** Draw a spec using only the selected parts and PPTX adapters in a portable runtime. */
export async function renderPptxEdge(spec: unknown, givenEngine: TextEngine, opts: Options): Promise<PptxEdgeResult> {
  const engine = guardedEngine(givenEngine);
  const pngScale = opts.pngScale ?? 2;
  if (!(Number.isFinite(pngScale) && pngScale > 0)) throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
  let prepared: Awaited<ReturnType<ReturnType<typeof prepareSpecLayout>>>;
  try { prepared = await prepareSpecLayout(spec, opts)(engine.measure); }
  catch (error) {
    if (error instanceof SpecError) return noPptx([...error.issues]);
    if (error instanceof TextEngineError) throw error;
    return noPptx([layoutIssue(spec, error)]);
  }
  const maxHeight = opts.maxHeight ?? MAX_EDGE_HEIGHT;
  if (prepared.placed.canvasHeight > maxHeight) {
    return noPptx([{path: '', message: `the figure is ${prepared.placed.canvasHeight}px tall; the limit is ${maxHeight}px`}]);
  }
  const {plan, native} = planPreparedPptx(prepared, {...opts, title: opts.title ?? prepared.placed.title});
  const issues = outlinePptxPictures(spec, plan, engine);
  if (issues.length) return noPptx(issues);
  const pngs: Uint8Array[] = [];
  for (const picture of plan.pictures) pngs.push(await opts.rasterize(picture.pngSvg, pngScale));
  return {pptx: await zipPackage(packageEntries(plan, pngs)), issues: [], native, pictures: plan.pictures.length};
}
