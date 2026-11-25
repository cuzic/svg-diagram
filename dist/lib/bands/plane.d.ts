import type { BandDef, WithBandDef } from '../band-def.ts';
import { plane as build } from '../dsl/plane.ts';
import type { LaidOutPlane, PlaneBand, PlaneOpts } from '../types/figures.ts';
export declare const planeDefinition: BandDef<PlaneBand, LaidOutPlane>;
export declare function plane<const Id extends string = never>(opts: PlaneOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutPlane>;
