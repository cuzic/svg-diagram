import type { BandDef, WithBandDef } from '../band-def.ts';
import { valueChain as build } from '../dsl/value-chain.ts';
import type { ValueChainBand, ValueChainOpts, FlowStep, LaidOutFlowShape } from '../flow-shapes.ts';
export declare function valueChain<const Id extends string = never, const S extends readonly (string | FlowStep)[] = readonly (string | FlowStep)[], const P extends readonly (string | FlowStep)[] = readonly (string | FlowStep)[]>(parts: {
    support?: S;
    primary: P;
}, opts?: ValueChainOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id, S, P>>, LaidOutFlowShape>;
/** @internal Definition used by the full renderer. */
export declare const valueChainDefinition: BandDef<ValueChainBand, LaidOutFlowShape>;
