import type { BandDef, WithBandDef } from '../band-def.ts';
import type { TreemapNode, TreemapOpts } from '../charts-treemap.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { treemap as build } from '../dsl/treemap.ts';
export declare function treemap<const T extends TreemapNode | readonly TreemapNode[], const Id extends string = never>(tree: T, opts?: TreemapOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<T, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const treemapDefinition: BandDef<ChartBand, LaidOutChart>;
