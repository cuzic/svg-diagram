import type { BandDef, WithBandDef } from '../band-def.ts';
import type { WaterfallOpts, WaterfallStep } from '../charts-waterfall.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { waterfall as build } from '../dsl/waterfall.ts';
export declare function waterfall<const S extends readonly WaterfallStep[], const Id extends string = never>(steps: S, opts?: WaterfallOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<S, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const waterfallDefinition: BandDef<ChartBand, LaidOutChart>;
