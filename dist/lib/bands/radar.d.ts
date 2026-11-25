import type { BandDef, WithBandDef } from '../band-def.ts';
import type { RadarOpts, RadarSeries } from '../charts-radar.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { radar as build } from '../dsl/radar.ts';
export declare function radar<const S extends readonly RadarSeries[], const Id extends string = never>(axes: readonly string[], series: S, opts?: RadarOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<S, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const radarDefinition: BandDef<ChartBand, LaidOutChart>;
