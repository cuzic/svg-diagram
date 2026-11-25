import { guardedEngine, MAX_EDGE_HEIGHT, TextEngineError } from './spec-edge-core.js';
import { noPptx, outlinePptxPictures, zipPackage } from './pptx-edge-core.js';
import { prepareSpecLayout, SpecError } from './spec-selective.js';
import { layoutIssue } from './spec-result.js';
import { packageEntries } from './pptx/package.js';
import { planPreparedPptx } from './pptx/selective.js';
export { TextEngineError } from './spec-edge-core.js';
export async function planSelectedFigureEdge(spec, engine, opts) {
    let prepared;
    try {
        prepared = await prepareSpecLayout(spec, opts)(engine.measure);
    }
    catch (error) {
        if (error instanceof SpecError)
            return { issues: [...error.issues] };
        if (error instanceof TextEngineError)
            throw error;
        return { issues: [layoutIssue(spec, error)] };
    }
    const maxHeight = opts.maxHeight ?? MAX_EDGE_HEIGHT;
    if (prepared.placed.canvasHeight > maxHeight) {
        return { issues: [{ path: '', message: `the figure is ${prepared.placed.canvasHeight}px tall; the limit is ${maxHeight}px` }] };
    }
    const { plan, native } = planPreparedPptx(prepared, { ...opts, title: opts.title ?? prepared.placed.title });
    const issues = outlinePptxPictures(spec, plan, engine);
    if (issues.length)
        return { issues };
    const { width, canvasHeight } = prepared.placed;
    const { warnings, problems } = prepared.verdict;
    return { plan, native, width: Math.max(96, width), height: Math.max(96, canvasHeight), findings: [...warnings, ...problems] };
}
/** Draw a spec using only the selected parts and PPTX adapters in a portable runtime. */
export async function renderPptxEdge(spec, givenEngine, opts) {
    const engine = guardedEngine(givenEngine);
    const pngScale = opts.pngScale ?? 2;
    if (!(Number.isFinite(pngScale) && pngScale > 0))
        throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
    const figure = await planSelectedFigureEdge(spec, engine, opts);
    if ('issues' in figure)
        return noPptx(figure.issues);
    const { plan, native } = figure;
    const pngs = [];
    for (const picture of plan.pictures)
        pngs.push(await opts.rasterize(picture.pngSvg, pngScale));
    return { pptx: await zipPackage(packageEntries(plan, pngs)), issues: [], native, pictures: plan.pictures.length };
}
