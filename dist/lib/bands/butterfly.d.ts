import type { BandDef, WithBandDef } from '../band-def.ts';
import type { ButterflyRow, ButterflyOpts } from '../charts-butterfly.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { butterfly as build } from '../dsl/butterfly.ts';
export declare function butterfly<const R extends readonly ButterflyRow[], const Id extends string = never>(rows: R, opts: ButterflyOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<R, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const butterflyDefinition: BandDef<ChartBand, LaidOutChart>;
