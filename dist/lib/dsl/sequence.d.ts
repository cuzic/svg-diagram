import type { SequenceBand, SequenceOpts } from '../types/sequence-table-swimlane.ts';
import type { ActorIn, Declares, HandleOf, SeqStepIn } from '../strict.ts';
export declare function sequence<const A extends string, const Id extends string = never>(actors: ActorIn<A>[], steps: SeqStepIn<NoInfer<A>>[], opts?: SequenceOpts & {
    id?: Id;
}): SequenceBand & Declares<Id> & HandleOf<Id>;
