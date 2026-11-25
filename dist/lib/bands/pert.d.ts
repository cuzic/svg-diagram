import type { PertTask } from '../semnet-critical-path.ts';
import type { BandDef, WithBandDef } from '../band-def.ts';
import type { PertOpts } from '../semnet-pert.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { pert as build } from '../dsl/pert.ts';
export declare function pert<const T extends readonly PertTask[], const Id extends string = never>(tasks: T, opts?: PertOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<T, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const pertDefinition: BandDef<ChartBand, LaidOutChart>;
