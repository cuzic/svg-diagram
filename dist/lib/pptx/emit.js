// The shell of the PPTX writer: reads the package template, draws the PNG fallbacks and zips. Everything between is pure (slide.ts, package.ts).
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { zipStore } from './zip.js';
import { planSlide, fontsOf } from './slide.js';
import { packageEntries } from './package.js';
/** The font files of a measuring configuration (`#n` face index stripped), for {@link PptxOptions.rasterFonts}. */
export const fontFilesOf = (specs) => [...new Set(Object.values(specs ?? {}).flatMap(f => [f?.regular, f?.bold]).filter((f) => !!f).map(f => f.replace(/#\d+$/, '')))];
const TEMPLATE = new URL('./template/', import.meta.url);
function readTemplate(dir = TEMPLATE, prefix = '') {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? readTemplate(new URL(e.name + '/', dir), prefix + e.name + '/') : [{ name: prefix + e.name, data: fs.readFileSync(new URL(e.name, dir)) }]);
}
let template;
function rasterize(svg, fontFiles, scale) {
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
    return zipStore(packageEntries(template ??= readTemplate(), plan, pngs));
}
