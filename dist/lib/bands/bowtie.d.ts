import type { BandDef, WithBandDef } from '../band-def.ts';
import { bowtie as build } from '../dsl/bowtie.ts';
import type { BowtieBand, BowtieInput, BowtieOpts, LaidOutBowtie } from '../types/diagrams.ts';
export declare function bowtie<const Id extends string = never>(input: BowtieInput, opts?: BowtieOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutBowtie>;
/** @internal Definition used by the full renderer. */
export declare const bowtieDefinition: BandDef<BowtieBand, LaidOutBowtie>;
