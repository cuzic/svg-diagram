// The definitions of the bands a figure was made from, looked up by a placed band: what the renderer (core.ts) knows while it lays a
// figure out, found again from `figure.bands` alone, for a writer that starts from the laid-out figure (the SVG of a picture in a slide).
import {defOf} from './band-def.ts';
import type {BandDef} from './band-def.ts';
import type {Band, LaidOutBand} from './types/index.ts';

/** The key a definition is registered under: a figure kind or a state matrix has a definition of its own. */
export function definitionKey(band: Band | LaidOutBand): string {
  if (band.type === 'chart') return `chart:${band.kind}`;
  if (band.type === 'screens' && (('matrix' in band && band.matrix) || ('layoutKind' in band && band.layoutKind === 'matrix'))) return 'screens:matrix';
  return band.type;
}

/**
 * Finds the definition of a placed band among those the figure's bands (nested and generated ones included) carry, then among `extra`
 * (looked up by type; the definitions of one type that differ by kind, such as the chart ones, cannot be told apart in a list).
 */
export function definitionsOf(bands: readonly Band[], extra: readonly BandDef[] = []): (band: LaidOutBand) => BandDef | undefined {
  const definitions = new Map<string, BandDef>(), outputs = new Map<string, BandDef>(), listed = new Map<string, BandDef>();
  for (const def of extra) {
    if (listed.has(def.type)) throw new Error(`svg-diagram: definitions has more than one definition for "${def.type}"; pass definitionOf to emitSvg to choose by kind`);
    listed.set(def.type, def);
  }
  const visit = (data: Band): void => {
    const def = defOf(data);
    if (!def) return;
    definitions.set(definitionKey(data), def);
    if (def.internal) for (const type of def.outputTypes ?? []) outputs.set(type, def);
    for (const generated of def.generated?.(data) ?? []) visit(generated);
    for (const child of def.children?.(data) ?? []) visit(child);
  };
  for (const data of bands) visit(data);
  return band => definitions.get(definitionKey(band)) ?? outputs.get(band.type) ?? listed.get(band.type);
}
