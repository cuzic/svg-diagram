import type { LaidOutDiagram } from '../types/index.ts';
import type { FontSpecs } from '../types/project.ts';
import { type SlidePlan } from './package.ts';
export interface PptxOptions {
    /** Typeface written into the runs (and used for monospace too); the measuring font is the project's, so keep them the same. */
    font?: string;
    /** PNG fallback scale (default 2). */
    pngScale?: number;
    /** The font files the PNG fallbacks are drawn with, normally those the diagram was measured with ({@link fontFilesOf}); `[]` means the system fonts. */
    rasterFonts: readonly string[];
}
/** The font files of a measuring configuration (`#n` face index stripped), for {@link PptxOptions.rasterFonts}. */
export declare const fontFilesOf: (specs: FontSpecs | undefined) => string[];
/** Serialize one laid-out diagram to a deterministic, single-slide PowerPoint package. */
export declare function emitPptx(laidOut: LaidOutDiagram, opts: PptxOptions): Buffer;
/** A slide plan and the PNGs of its pictures as the .pptx package (also how the judges wrap a hand-written slide). */
export declare function packSlide(plan: SlidePlan, pngs: readonly Buffer[]): Buffer;
