import type { BandDef, WithBandDef } from '../band-def.ts';
import type { LaidOutRaw, RawBand, RawOpts } from '../types/containers.ts';
export declare function raw(opts: RawOpts): WithBandDef<RawBand, LaidOutRaw>;
/** @internal Definition used by the full renderer. */
export declare const rawDefinition: BandDef<RawBand, LaidOutRaw>;
