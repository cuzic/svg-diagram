import type { BandDef, WithBandDef } from '../band-def.ts';
import type { TornadoItem, TornadoOpts } from '../charts-tornado.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { tornado as build } from '../dsl/tornado.ts';
export declare function tornado<const I extends readonly TornadoItem[], const Id extends string = never>(items: I, opts: TornadoOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<I, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const tornadoDefinition: BandDef<ChartBand, LaidOutChart>;
