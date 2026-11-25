import type { BandDef, WithBandDef } from '../band-def.ts';
import type { PyramidLayers } from '../strict.ts';
import type { PyramidBand, PyramidOpts, LaidOutPyramid } from '../types/figures.ts';
export declare function pyramid(layers: PyramidLayers, opts?: PyramidOpts): WithBandDef<PyramidBand, LaidOutPyramid>;
/** @internal Definition used by the full renderer. */
export declare const pyramidDefinition: BandDef<PyramidBand, LaidOutPyramid>;
