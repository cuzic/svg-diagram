import type { BandDef } from './band-def.ts';
import type { ToneEnv } from './tokens.ts';
import type { Roles, Theme } from './types/core.ts';
import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
export { resolveTextColor, resolveBoxStyle } from './emit-common.ts';
export type { BoxStyle } from './emit-common.ts';
export { renderFlowShape } from './emit-flow-shape.ts';
type DefinitionOf = (band: LaidOutBand) => BandDef | undefined;
export declare const renderBandWith: (definitionOf: DefinitionOf) => (band: LaidOutBand, theme: Theme, tones: ToneEnv, roles: Roles, stage?: number, dimFill?: boolean) => string;
/**
 * `definitionOf`: the definition of each placed band. The default finds them among the definitions the figure's own bands carry, which is
 * every band a selective entry drew; a full entry passes the table of the built-in definitions (placed-definitions.ts).
 * `parts`: mark each part's elements with `data-part` (ADR 0054), for the PowerPoint export; nothing else changes.
 */
export declare function emitSvg(laidOutDiagram: LaidOutDiagram, opts?: {
    reveal?: number;
    noRecolor?: boolean;
    nodeIds?: boolean;
    parts?: boolean;
    definitions?: readonly BandDef[];
}, definitionOf?: DefinitionOf): string;
