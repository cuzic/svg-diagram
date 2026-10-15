// The shell of the PPTX writer: reads the package template, draws the PNG fallbacks and zips. Everything between is pure (slide.ts, package.ts).
import fs from 'node:fs';
import {Resvg} from '@resvg/resvg-js';
import type {LaidOutDiagram} from '../types/index.ts';
import type {FontSpecs} from '../types/project.ts';
import {zipStore} from './zip.ts';
import {planSlide} from './slide.ts';
import {packageEntries, type Entry, type SlidePlan} from './package.ts';

// The font measured by the project and written here must match (ADR 0027); BIZ UDPGothic is the PPTX default.
const DEFAULT_FONT = 'BIZ UDPGothic';
const DEFAULT_MONO_FONT = 'BIZ UDGothic';

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

const TEMPLATE = new URL('./template/', import.meta.url);
function readTemplate(dir = TEMPLATE, prefix = ''): Entry[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? readTemplate(new URL(e.name + '/', dir), prefix + e.name + '/') : [{name: prefix + e.name, data: fs.readFileSync(new URL(e.name, dir))}]);
}
let template: Entry[] | undefined;

function rasterize(svg: string, fontFiles: readonly string[], scale: number): Buffer {
  const font = fontFiles.length ? {loadSystemFonts: false, fontFiles: [...fontFiles]} : {loadSystemFonts: true};
  return Buffer.from(new Resvg(svg, {font, fitTo: {mode: 'zoom', value: scale}}).render().asPng());
}

/** Serialize one laid-out diagram to a deterministic, single-slide PowerPoint package. */
export function emitPptx(laidOut: LaidOutDiagram, opts: PptxOptions): Buffer {
  const {font, pngScale = 2, rasterFonts} = opts;
  if (!(Number.isFinite(pngScale) && pngScale > 0)) throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
  const plan = planSlide(laidOut, {sans: font ?? DEFAULT_FONT, mono: font ?? DEFAULT_MONO_FONT});
  return packSlide(plan, plan.pictures.map(p => rasterize(p.pngSvg, rasterFonts, pngScale)));
}

/** A slide plan and the PNGs of its pictures as the .pptx package (also how the judges wrap a hand-written slide). */
export function packSlide(plan: SlidePlan, pngs: readonly Buffer[] = []): Buffer {
  return zipStore(packageEntries(template ??= readTemplate(), plan, pngs));
}
