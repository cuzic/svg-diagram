import type { BandDef } from '../band-def.ts';
import type { AnchorsOf, FlowCheck, FlowIn, LaneCheck, StepCheck, StepIds, SwimlaneStepIn } from '../strict.ts';
import type { ConnectBand, LaidOutConnect } from '../types/containers.ts';
import type { LaidOutSwimlane, SwimlaneBand, SwimlaneLane, SwimlaneOpts } from '../types/sequence-table-swimlane.ts';
export declare function swimlane<const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never>(lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>, opts?: Omit<SwimlaneOpts, 'flows' | 'id'> & {
    id?: Id;
    flows?: F & FlowCheck<StepIds<S>, F>;
}, connectors?: BandDef<ConnectBand, LaidOutConnect>): (import("../band-def.ts").WithBandDef<ConnectBand, LaidOutConnect> | import("../band-def.ts").WithBandDef<SwimlaneBand & import("../strict.ts").Declares<Id | (S[number] extends infer T ? T extends S[number] ? T extends {
    readonly id: infer I extends string;
} ? I : never : never : never)>, LaidOutSwimlane>)[] & AnchorsOf<StepIds<S> | Id>;
/** @internal Definition used by the full renderer. */
export declare const swimlaneDefinition: BandDef<SwimlaneBand, LaidOutSwimlane>;
