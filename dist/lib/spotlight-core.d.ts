import type { BandDef } from './band-def.ts';
import { spotlightDim } from './emit-spotlight.ts';
import type { ScopeTable } from './scope-table.ts';
import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
export { dimmedBands } from './spotlight-legend.ts';
/** Supply as `spotlighter` when focusing selected bands. */
export declare const spotlighter: {
    apply(placed: LaidOutDiagram, definitionOf: (band: LaidOutBand) => BandDef | undefined, scopes: ScopeTable): void;
    dim: typeof spotlightDim;
    renderBand(band: LaidOutBand, svg: string, def: BandDef): string;
};
