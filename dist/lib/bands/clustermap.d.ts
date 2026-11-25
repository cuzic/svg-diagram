import type { BandDef, WithBandDef } from '../band-def.ts';
import type { ClusterOpts } from '../charts-cluster.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { clustermap as buildClustermap } from '../dsl/clustermap.ts';
export declare function clustermap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly number[])[], opts?: ClusterOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildClustermap<Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const clustermapDefinition: BandDef<ChartBand, LaidOutChart>;
