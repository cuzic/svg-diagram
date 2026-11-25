import type { BandDef } from './band-def.ts';
import type { Band, LaidOutBand } from './types/index.ts';
/** The key a definition is registered under: a figure kind or a state matrix has a definition of its own. */
export declare function definitionKey(band: Band | LaidOutBand): string;
/**
 * Finds the definition of a placed band among those the figure's bands (nested and generated ones included) carry, then among `extra`
 * (looked up by type; the definitions of one type that differ by kind, such as the chart ones, cannot be told apart in a list).
 */
export declare function definitionsOf(bands: readonly Band[], extra?: readonly BandDef[]): (band: LaidOutBand) => BandDef | undefined;
