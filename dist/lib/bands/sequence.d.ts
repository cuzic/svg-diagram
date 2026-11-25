import type { BandDef, WithBandDef } from '../band-def.ts';
import { sequence as build } from '../dsl/sequence.ts';
import type { ActorIn, SeqStepIn } from '../strict.ts';
import type { LaidOutSequence, SequenceBand, SequenceOpts } from '../types/sequence-table-swimlane.ts';
export declare function sequence<const A extends string, const Id extends string = never>(actors: ActorIn<A>[], steps: SeqStepIn<NoInfer<A>>[], opts?: SequenceOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<A, Id>>, LaidOutSequence>;
/** @internal Definition used by the full renderer. */
export declare const sequenceDefinition: BandDef<SequenceBand, LaidOutSequence>;
