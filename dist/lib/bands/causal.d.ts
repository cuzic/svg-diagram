import type { CausalLink } from '../semnet-causal-loops.ts';
import type { BandDef, WithBandDef } from '../band-def.ts';
import type { CausalIntervention, CausalNode, CausalOpts } from '../semnet-causal.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { causalLoop as build } from '../dsl/causal.ts';
export declare function causalLoop<const N extends readonly CausalNode[], const I extends readonly CausalIntervention[] = readonly [], const Id extends string = never>(nodes: N, links: readonly CausalLink[], opts?: Omit<CausalOpts, 'interventions'> & {
    interventions?: I;
} & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<N, I, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const causalDefinition: BandDef<ChartBand, LaidOutChart>;
