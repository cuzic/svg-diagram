import type { ChartBand } from '../charts.ts';
import type { DependencyEdge, DependencyNode, DependencyOpts } from '../semnet.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { ChartIds } from './chart-ids.ts';
/** A typed / weighted dependency network with an automatic notation legend. */
export declare function dependencyNetwork<const N extends readonly DependencyNode[], const Id extends string = never>(nodes: N, edges: readonly DependencyEdge[], opts?: DependencyOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<N>> & HandleOf<Id> & AnchorsOf<ChartIds<N>>;
