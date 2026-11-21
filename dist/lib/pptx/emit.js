// The Node shell of the PPTX writer: draws the PNG fallbacks with resvg and zips with node:zlib. Everything between is pure (slide.ts,
// package.ts); ../pptx-edge.ts is the same writer for a Worker.
import { createRequire } from 'node:module';
import { zipStore } from './zip-node.js';
import { planSlide, fontsOf } from './slide.js';
import { packageEntries } from './package.js';
/** The font files of a measuring configuration (`#n` face index stripped), for {@link PptxOptions.rasterFonts}. */
export const fontFilesOf = (specs) => [...new Set(Object.values(specs ?? {}).flatMap(f => [f?.regular, f?.bold]).filter((f) => !!f).map(f => f.replace(/#\d+$/, '')))];
// resvg is loaded when a PNG is first drawn, so that the rest of svg-diagram loads on a machine without it (a browser-only one); the .pptx writer itself needs it.
export function rasterize(svg, fontFiles, scale) {
    let Resvg;
    try {
        ({ Resvg } = createRequire(import.meta.url)('@resvg/resvg-js'));
    }
    catch {
        throw new Error('pptx: @resvg/resvg-js could not be loaded on this machine (the PNG fallbacks of the slide are drawn with it).');
    }
    const font = fontFiles.length ? { loadSystemFonts: false, fontFiles: [...fontFiles] } : { loadSystemFonts: true };
    return Buffer.from(new Resvg(svg, { font, fitTo: { mode: 'zoom', value: scale } }).render().asPng());
}
/** Serialize one laid-out diagram to a deterministic, single-slide PowerPoint package. */
export function emitPptx(laidOut, opts) {
    const { font, pngScale = 2, rasterFonts } = opts;
    if (!(Number.isFinite(pngScale) && pngScale > 0))
        throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
    const plan = planSlide(laidOut, fontsOf(font));
    return packSlide(plan, plan.pictures.map(p => rasterize(p.pngSvg, rasterFonts, pngScale)));
}
/** A slide plan and the PNGs of its pictures as the .pptx package (also how the judges wrap a hand-written slide). */
export function packSlide(plan, pngs) {
    return zipStore(packageEntries(plan, pngs));
}
