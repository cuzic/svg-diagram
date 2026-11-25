import type { BandDef, WithBandDef } from '../band-def.ts';
import type { SankeyOpts, SankeyNode, SankeyLink } from '../charts-sankey.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { sankey as build } from '../dsl/sankey.ts';
export declare function sankey<const N extends readonly (SankeyNode | string)[], const Id extends string = never>(nodes: N, links: readonly SankeyLink[], opts?: SankeyOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<N, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const sankeyDefinition: BandDef<ChartBand, LaidOutChart>;
