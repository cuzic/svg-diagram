import type { BandDef, WithBandDef } from '../band-def.ts';
import type { CompareCell, CompareOpts } from '../charts-compare.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { compare as build } from '../dsl/compare.ts';
export declare function compare<const Id extends string = never>(rows: readonly string[], cols: readonly string[], cells: readonly (readonly CompareCell[])[], opts?: CompareOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const compareDefinition: BandDef<ChartBand, LaidOutChart>;
