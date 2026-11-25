// Placed (laid-out) bands of the full renderer, resolved to their definitions. A figure that was laid out earlier carries no definition on
// its placed bands (a PowerPoint slide, an HTML overlay and the location map start from the laid-out figure alone), so the type is looked up
// in the full set of built-in definitions. A selective entry never imports this module: its bands carry their definitions.
import type {BandDef} from './band-def.ts';
import {definitionFor} from './full-definitions.ts';
import type {Band, LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {CheckRect} from './types/verdicts.ts';
import {collectRectsWith} from './verify-rects.ts';

/** @internal The built-in definition of a placed band (its figure kind or matrix layout included). */
export function placedDefinitionOf(band: LaidOutBand): BandDef | undefined {
  return definitionFor(band as unknown as Band) as BandDef | undefined;
}

/** Every text size one placed band draws, as its definition lists them. */
export function bandTextSizes(band: LaidOutBand): Iterable<number> {
  return placedDefinitionOf(band)?.textSizes?.(band as never) ?? [];
}

/** Every checkable rect of a laid-out figure, in band order. */
export function collectRects(diagram: LaidOutDiagram): CheckRect[] {
  return collectRectsWith(diagram, placedDefinitionOf);
}
