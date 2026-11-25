import type { BandDef, WithBandDef } from '../band-def.ts';
import { pareto as buildPareto } from '../dsl/bars.ts';
import type { HistogramOpts, ParetoOpts } from '../dsl/bars.ts';
import type { BarDatum, BarsBand, BarsOpts, LaidOutBars } from '../types/bars.ts';
export declare function bars<const D extends readonly BarDatum[], const Id extends string = never>(data: D, opts?: BarsOpts & {
    id?: Id;
}): WithBandDef<BarsBand & import("../strict.ts").Declares<Id | Extract<D[number]["id"], string>> & import("../strict.ts").HandleOf<Id> & import("../strict.ts").AnchorsOf<Extract<D[number]["id"], string>>, LaidOutBars>;
export declare function rangeBars<const D extends readonly (Omit<BarDatum, 'value' | 'range'> & {
    range: readonly [number, number];
})[], const Id extends string = never>(data: D, opts?: BarsOpts & {
    id?: Id;
}): WithBandDef<BarsBand & import("../strict.ts").Declares<Id | Extract<(D & readonly BarDatum[])[number]["id"], string>> & import("../strict.ts").HandleOf<Id> & import("../strict.ts").AnchorsOf<Extract<(D & readonly BarDatum[])[number]["id"], string>>, LaidOutBars>;
export declare function pareto<const Id extends string = never>(items: Parameters<typeof buildPareto>[0], opts?: ParetoOpts & {
    id?: Id;
}): WithBandDef<BarsBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutBars>;
export declare function histogram<const Id extends string = never>(values: readonly number[], opts?: HistogramOpts & {
    id?: Id;
}): WithBandDef<BarsBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutBars>;
/** @internal Definition used by the full renderer. */
export declare const barsDefinition: BandDef<BarsBand, LaidOutBars>;
