import type { BandDef, WithBandDef } from '../band-def.ts';
import { venn as build } from '../dsl/venn.ts';
import type { VennBand, VennOpts, VennSet, LaidOutFlowShape } from '../flow-shapes.ts';
export declare function venn<const Id extends string = never, const I extends readonly VennSet[] = readonly VennSet[]>(sets: I, opts?: VennOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id, I>>, LaidOutFlowShape>;
/** @internal Definition used by the full renderer. */
export declare const vennDefinition: BandDef<VennBand, LaidOutFlowShape>;
