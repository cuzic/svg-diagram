import type { BandDef, WithBandDef } from '../band-def.ts';
import { people as build } from '../dsl/people.ts';
import type { LaidOutPeople, PeopleBand, PeopleOpts } from '../types/people-dots.ts';
export declare function people<const Id extends string = never>(total: number, count: number | readonly [number, number], opts?: PeopleOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutPeople>;
/** @internal Definition used by the full renderer. */
export declare const peopleDefinition: BandDef<PeopleBand, LaidOutPeople>;
