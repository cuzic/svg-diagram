import type {LaidOutDiagram} from '../types/index.ts';
import {buildSlide, type PptxOptions, type Report} from './slide.ts';
import {packPptx} from './package.ts';

export {packPptx, type Extra} from './package.ts';
export {buildSlide, type PptxOptions, type Report} from './slide.ts';

/** Serialize one laid-out diagram to a deterministic, single-slide PowerPoint package. Reads only the bundled template; writes nothing. */
export function emitPptx(laidOut: LaidOutDiagram, opts: PptxOptions = {}): Buffer {
  if (!(Number.isFinite(opts.pngScale ?? 2) && (opts.pngScale ?? 2) > 0)) throw new Error(`pngScale must be a positive number (got ${String(opts.pngScale)})`);
  const built = buildSlide(laidOut, opts.name ?? 'diagram', opts);
  return packPptx(built.xml, built.widthEmu, built.heightEmu, built.extra);
}

export function pptxReport(laidOut: LaidOutDiagram, opts: PptxOptions = {}): Report {
  return buildSlide(laidOut, opts.name ?? 'diagram', opts).report;
}
