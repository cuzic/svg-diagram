import type {BandDef} from './band-def.ts';
import {applySpotlightWith, dimBandSvg, spotlightDim} from './emit-spotlight.ts';
import type {ScopeTable} from './scope-table.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';

export {dimmedBands} from './spotlight-legend.ts';

function spotlightDefinition(band: LaidOutBand, def: BandDef | undefined) {
  return def?.internal ? def.spotlightOutputs?.[band.type] ?? def : def;
}

/** Supply as `spotlighter` when focusing selected bands. */
export const spotlighter = {
  apply(placed: LaidOutDiagram, definitionOf: (band: LaidOutBand) => BandDef | undefined, scopes: ScopeTable) {
    applySpotlightWith(placed, band => spotlightDefinition(band, definitionOf(band))?.spotlight, scopes);
  },
  dim: spotlightDim,
  renderBand(band: LaidOutBand, svg: string, def: BandDef): string {
    return band.dim && !spotlightDefinition(band, def)?.selfDimming ? dimBandSvg(svg) : svg;
  },
};
