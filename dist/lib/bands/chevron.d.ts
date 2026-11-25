import type { BandDef, WithBandDef } from '../band-def.ts';
import { chevron as build } from '../dsl/chevron.ts';
import type { ChevronBand, ChevronOpts, FlowStep, LaidOutFlowShape } from '../flow-shapes.ts';
export declare function chevron<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: ChevronOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id, I>>, LaidOutFlowShape>;
/** @internal Definition used by the full renderer. */
export declare const chevronDefinition: BandDef<ChevronBand, LaidOutFlowShape>;
