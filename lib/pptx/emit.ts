// The Node shell of the PPTX writer: draws the PNG fallbacks with resvg and zips with node:zlib. Everything between is pure (slide.ts,
// package.ts); ../pptx-edge.ts is the same writer for a Worker.
import {createRequire} from 'node:module';
import type {Resvg as ResvgClass} from '@resvg/resvg-js';
import type {LaidOutDiagram} from '../types/index.ts';
import type {FontSpecs} from '../types/project.ts';
import {zipStore} from './zip-node.ts';
import {planSlide, fontsOf} from './slide.ts';
import {packageEntries, type SlidePlan} from './package.ts';

export interface PptxOptions {
  /** Typeface written into the runs (and used for monospace too); the measuring font is the project's, so keep them the same. */
  font?: string;
  /** PNG fallback scale (default 2). */
  pngScale?: number;
  /** The font files the PNG fallbacks are drawn with, normally those the diagram was measured with ({@link fontFilesOf}); `[]` means the system fonts. */
  rasterFonts: readonly string[];
}

/** The font files of a measuring configuration (`#n` face index stripped), for {@link PptxOptions.rasterFonts}. */
export const fontFilesOf = (specs: FontSpecs | undefined): string[] =>
  [...new Set(Object.values(specs ?? {}).flatMap(f => [f?.regular, f?.bold]).filter((f): f is string => !!f).map(f => f.replace(/#\d+$/, '')))];

// resvg is loaded when a PNG is first drawn, so that the rest of svg-diagram loads on a machine without it (a browser-only one); the .pptx writer itself needs it.
function rasterize(svg: string, fontFiles: readonly string[], scale: number): Buffer {
  let Resvg: typeof ResvgClass;
  try { ({Resvg} = createRequire(import.meta.url)('@resvg/resvg-js') as {Resvg: typeof ResvgClass}); }
  catch { throw new Error('pptx: @resvg/resvg-js could not be loaded on this machine (the PNG fallbacks of the slide are drawn with it).'); }
  const font = fontFiles.length ? {loadSystemFonts: false, fontFiles: [...fontFiles]} : {loadSystemFonts: true};
  return Buffer.from(new Resvg(svg, {font, fitTo: {mode: 'zoom', value: scale}}).render().asPng());
}

/** Serialize one laid-out diagram to a deterministic, single-slide PowerPoint package. */
export function emitPptx(laidOut: LaidOutDiagram, opts: PptxOptions): Buffer {
  const {font, pngScale = 2, rasterFonts} = opts;
  if (!(Number.isFinite(pngScale) && pngScale > 0)) throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
  const plan = planSlide(laidOut, fontsOf(font));
  return packSlide(plan, plan.pictures.map(p => rasterize(p.pngSvg, rasterFonts, pngScale)));
}

/** A slide plan and the PNGs of its pictures as the .pptx package (also how the judges wrap a hand-written slide). */
export function packSlide(plan: SlidePlan, pngs: readonly Uint8Array[]): Buffer {
  return zipStore(packageEntries(plan, pngs));
}
