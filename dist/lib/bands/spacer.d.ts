import type { BandDef, WithBandDef } from '../band-def.ts';
import type { SpacerBand } from '../types/containers.ts';
import type { Rect } from '../types/core.ts';
export declare const spacerDefinition: BandDef<SpacerBand, Rect>;
export declare function spacer(height: number): WithBandDef<SpacerBand, Rect>;
