import type { BandDef, WithBandDef } from '../band-def.ts';
import type { DependencyEdge, DependencyNode, DependencyOpts } from '../semnet-dependency.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { dependencyNetwork as build } from '../dsl/dependency.ts';
export declare function dependencyNetwork<const N extends readonly DependencyNode[], const Id extends string = never>(nodes: N, edges: readonly DependencyEdge[], opts?: DependencyOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<N, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const dependencyDefinition: BandDef<ChartBand, LaidOutChart>;
