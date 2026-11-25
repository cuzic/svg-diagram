import type { BandDef, WithBandDef } from '../band-def.ts';
import type { HarveyCell, HarveyRow, HarveyOpts } from '../charts-harvey.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { harvey as build } from '../dsl/harvey.ts';
export declare function harvey<const R extends readonly HarveyRow[], const Id extends string = never>(rows: R, cols: readonly string[], values: readonly (readonly HarveyCell[])[], opts?: HarveyOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<R, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const harveyDefinition: BandDef<ChartBand, LaidOutChart>;
