import type { BandDef, WithBandDef } from '../band-def.ts';
import type { ComboOpts, ComboSeries } from '../charts-combo.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { combo as build } from '../dsl/combo.ts';
export declare function combo<const S extends readonly ComboSeries[], const Id extends string = never>(categories: readonly string[], series: S, opts?: ComboOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<S, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const comboDefinition: BandDef<ChartBand, LaidOutChart>;
