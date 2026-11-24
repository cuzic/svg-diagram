import {visibleAt} from './reveal-visibility.ts';
import {defOf, walkDefinedBands} from './band-def.ts';
import {oneLine} from './diagram-description.ts';
import type {DiagramData} from './types/core.ts';

/** An explicit title wins; otherwise take the first eligible band at the best priority. */
export function definedDiagramTitle({title, bands}: Pick<DiagramData, 'title' | 'bands'>, stage?: number): string {
  if (title) return oneLine(title);
  let best: readonly [number, string | undefined] | undefined;
  for (const band of walkDefinedBands(bands)) {
    if (!visibleAt(band, stage)) continue;
    const candidate = defOf(band)?.title?.(band);
    if (!candidate) continue;
    if (candidate[0] === 0) return oneLine(candidate[1]);
    if (!best || candidate[0] < best[0]) best = candidate;
  }
  return oneLine(best?.[1]);
}
