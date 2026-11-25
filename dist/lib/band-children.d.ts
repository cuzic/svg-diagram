import type { BandDef } from './band-def.ts';
import type { Band } from './types/index.ts';
export type DefinitionOf = (band: Band) => BandDef | undefined;
/** The bands a band holds as children (none for most types). */
export declare function childrenOf(band: Band, definitionOf?: DefinitionOf): Band[];
/** Like childrenOf, plus a swimlane's steps: every band that sits inside another one. */
export declare function nestedBandsOf(band: Band, definitionOf?: DefinitionOf): Band[];
