// A JSON spec as a one-slide PowerPoint file, where there is no file system and no native code, such as a Cloudflare Worker
// ("svg-diagram/pptx/edge"). The same writer as `svg-diagram pptx` (ADR 0027): boxes, tables and connectors become native shapes, the
// other bands pictures (SVG with a PNG fallback). What the Node shell does with resvg and node:zlib is the caller's here: it hands in the
// text engine (as for renderSpecEdge) and a function that turns an SVG into a PNG. The pictures' text is turned into outlines first, so
// neither the PNG nor the SVG depends on fonts.
import { renderInBrowser } from './web.js';
import { outlineText } from './svg-outline.js';
import { SpecError, layoutIssue, specToDiagram } from './spec.js';
import { MAX_EDGE_HEIGHT, TextEngineError, guardedEngine, missingIssues } from './spec-edge.js';
import { planSlide, fontsOf } from './pptx/slide.js';
import { packageEntries } from './pptx/package.js';
import { zipEntries } from './pptx/zip.js';
export { TextEngineError } from './spec-edge.js';
const none = (issues) => ({ pptx: null, issues, native: 0, pictures: 0 });
/** Raw deflate where the runtime has CompressionStream (Workers, browsers, Node 18+); stored otherwise. */
async function deflateRaw(data) {
    if (typeof CompressionStream === 'undefined')
        return undefined;
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** The spec as a slide plan, or the issues that stop it (with their places in the spec). Throws TextEngineError as renderPptxEdge does. */
export async function planFigureEdge(spec, engine, opts = {}) {
    let d;
    try {
        d = specToDiagram(spec);
    }
    catch (e) {
        if (e instanceof SpecError)
            return { issues: [...e.issues] };
        throw e;
    }
    let r;
    try {
        r = await renderInBrowser(d, { measure: engine.measure });
    }
    catch (e) {
        if (e instanceof TextEngineError)
            throw e;
        return { issues: [layoutIssue(spec, e)] };
    }
    const maxHeight = opts.maxHeight ?? MAX_EDGE_HEIGHT;
    if (r.height > maxHeight)
        return { issues: [{ path: '', message: `the figure is ${r.height}px tall; the limit is ${maxHeight}px` }] };
    const plan = planSlide(r.laidOut, fontsOf(opts.font));
    // a picture's text as outlines, an emoji as text the viewer's emoji font draws; a character the font lacks is the spec's to fix, as in drawing
    const missing = [];
    const outline = (svg) => { const o = outlineText(svg, engine.font, engine.textBox, { liveEmoji: true }); missing.push(...o.missing); return o.svg; };
    plan.pictures = plan.pictures.map(p => ({ svg: outline(p.svg), pngSvg: outline(p.pngSvg) }));
    if (missing.length)
        return { issues: missingIssues(spec, missing) };
    return { plan, width: Math.max(96, r.laidOut.width), height: Math.max(96, r.laidOut.canvasHeight), native: r.laidOut.laidOut.length - plan.pictures.length, findings: [...r.verdict.warnings, ...r.verdict.problems] };
}
/** The entries zipped, the XML deflated where the runtime can (PNGs are stored: they are compressed already). */
export async function zipPackage(files) {
    const entries = [];
    for (const e of files)
        entries.push({ ...e, deflated: e.name.endsWith('.png') ? undefined : await deflateRaw(e.data) });
    return zipEntries(entries);
}
/**
 * The spec as a .pptx. A bad spec or a figure that cannot be laid out comes back as issues; a failure of the engine that was handed in
 * throws TextEngineError, and one of `rasterize` throws as it is. The drawing's own checks are renderSpecEdge's: run that first.
 */
export async function renderPptxEdge(spec, givenEngine, opts) {
    const engine = guardedEngine(givenEngine);
    const pngScale = opts.pngScale ?? 2;
    if (!(Number.isFinite(pngScale) && pngScale > 0))
        throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
    const f = await planFigureEdge(spec, engine, opts);
    if ('issues' in f)
        return none(f.issues);
    const pngs = [];
    for (const p of f.plan.pictures)
        pngs.push(await opts.rasterize(p.pngSvg, pngScale));
    return { pptx: await zipPackage(packageEntries(f.plan, pngs)), issues: [], native: f.native, pictures: f.plan.pictures.length };
}
