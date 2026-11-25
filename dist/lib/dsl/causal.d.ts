import type { ChartBand } from '../charts.ts';
import type { CausalLink } from '../semnet-causal-loops.ts';
import type { CausalIntervention, CausalNode, CausalOpts } from '../semnet.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { ChartIds } from './chart-ids.ts';
/** A causal-loop diagram. Link signs and delays are drawn; simple loops are classified R/B. */
export declare function causalLoop<const N extends readonly CausalNode[], const I extends readonly CausalIntervention[] = readonly [], const Id extends string = never>(nodes: N, links: readonly CausalLink[], opts?: Omit<CausalOpts, 'interventions'> & {
    id?: Id;
    interventions?: I;
}): ChartBand & Declares<Id | ChartIds<N> | ChartIds<I>> & HandleOf<Id> & AnchorsOf<ChartIds<N> | ChartIds<I>>;
