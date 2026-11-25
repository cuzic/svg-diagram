import type { BandDef, WithBandDef } from '../band-def.ts';
import type { StackColumn, StackedOpts } from '../charts-stacked.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { stackedBars as buildStacked, mekko as buildMekko } from '../dsl/stacked.ts';
export declare function stackedBars<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: StackedOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildStacked<C, Id>>, LaidOutChart>;
export declare function mekko<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: Omit<StackedOpts, 'percent'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildMekko<C, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const stackedDefinition: BandDef<ChartBand, LaidOutChart>;
