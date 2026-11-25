import type { BandDef, WithBandDef } from '../band-def.ts';
import type { ConcentricBand, ConcentricOpts, ConcentricRing, LaidOutFlowShape } from '../flow-shapes.ts';
export declare function concentric(rings: readonly ConcentricRing[] | number, opts?: ConcentricOpts): WithBandDef<ConcentricBand, LaidOutFlowShape>;
/** @internal Definition used by the full renderer. */
export declare const concentricDefinition: BandDef<ConcentricBand, LaidOutFlowShape>;
