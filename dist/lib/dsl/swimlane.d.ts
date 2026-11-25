import type { ConnectBand } from '../types/containers.ts';
import type { SwimlaneBand, SwimlaneLane, SwimlaneOpts } from '../types/sequence-table-swimlane.ts';
import type { AnchorsOf, Declares, FlowCheck, FlowIn, LaneCheck, StepCheck, StepIds, SwimlaneStepIn } from '../strict.ts';
export declare function swimlane<const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never>(lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>, opts?: Omit<SwimlaneOpts, 'flows' | 'id'> & {
    id?: Id;
    flows?: F & FlowCheck<StepIds<S>, F>;
}): ((SwimlaneBand & Declares<StepIds<S> | Id>) | ConnectBand)[] & AnchorsOf<StepIds<S> | Id>;
