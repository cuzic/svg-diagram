import type { BandDef, WithBandDef } from '../band-def.ts';
import { cycle as build } from '../dsl/cycle.ts';
import type { CycleBand, CycleOpts, FlowStep, LaidOutFlowShape } from '../flow-shapes.ts';
export declare function cycle<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: CycleOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id, I>>, LaidOutFlowShape>;
/** @internal Definition used by the full renderer. */
export declare const cycleDefinition: BandDef<CycleBand, LaidOutFlowShape>;
