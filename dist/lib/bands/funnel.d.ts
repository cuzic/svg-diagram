import type { BandDef, WithBandDef } from '../band-def.ts';
import { funnel as build } from '../dsl/funnel.ts';
import type { FunnelBand, FunnelOpts, FunnelStage, LaidOutFlowShape } from '../flow-shapes.ts';
export declare function funnel<const Id extends string = never, const I extends readonly FunnelStage[] = readonly FunnelStage[]>(stages: I, opts?: FunnelOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id, I>>, LaidOutFlowShape>;
/** @internal Definition used by the full renderer. */
export declare const funnelDefinition: BandDef<FunnelBand, LaidOutFlowShape>;
