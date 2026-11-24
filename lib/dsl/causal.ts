import type {ChartBand} from '../charts.ts';
import {causalBand} from '../semnet-dsl.ts';
import type {CausalLink} from '../semnet-analysis.ts';
import type {CausalIntervention, CausalNode, CausalOpts} from '../semnet.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import type {ChartIds} from './chart-ids.ts';

/** A causal-loop diagram. Link signs and delays are drawn; simple loops are classified R/B. */
export function causalLoop<const N extends readonly CausalNode[], const I extends readonly CausalIntervention[] = readonly [], const Id extends string = never>(nodes: N, links: readonly CausalLink[], opts?: Omit<CausalOpts, 'interventions'> & {id?: Id; interventions?: I}): ChartBand & Declares<Id | ChartIds<N> | ChartIds<I>> & HandleOf<Id> & AnchorsOf<ChartIds<N> | ChartIds<I>>;
export function causalLoop(nodes: readonly CausalNode[], links: readonly CausalLink[], opts: CausalOpts = {}): ChartBand { const band = causalBand(nodes, links, opts); return withHandle(withAnchors(band, band.ids), opts.id); }
