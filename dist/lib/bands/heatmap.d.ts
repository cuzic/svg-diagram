import type { BandDef, WithBandDef } from '../band-def.ts';
import type { HeatmapOpts } from '../charts-heatmap.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { heatmap as build } from '../dsl/heatmap.ts';
export declare function heatmap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts?: HeatmapOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const heatmapDefinition: BandDef<ChartBand, LaidOutChart>;
