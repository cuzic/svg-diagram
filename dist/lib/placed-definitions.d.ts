import type { BandDef } from './band-def.ts';
import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
import type { CheckRect } from './types/verdicts.ts';
/** @internal The built-in definition of a placed band (its figure kind or matrix layout included). */
export declare function placedDefinitionOf(band: LaidOutBand): BandDef | undefined;
/** Every text size one placed band draws, as its definition lists them. */
export declare function bandTextSizes(band: LaidOutBand): Iterable<number>;
/** Every checkable rect of a laid-out figure, in band order. */
export declare function collectRects(diagram: LaidOutDiagram): CheckRect[];
