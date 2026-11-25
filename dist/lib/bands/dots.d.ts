import type { BandDef, WithBandDef } from '../band-def.ts';
import { dots as build } from '../dsl/dots.ts';
import type { LaidOutDots, DotsBand, DotsOpts, DotDatum } from '../types/people-dots.ts';
export declare function dots<const Id extends string = never>(values: readonly DotDatum[], opts?: DotsOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutDots>;
/** @internal Definition used by the full renderer. */
export declare const dotsDefinition: BandDef<DotsBand, LaidOutDots>;
