import type { BandDef, WithBandDef } from '../band-def.ts';
import type { RegData, RegOpts } from '../charts-reg.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { regplot as buildRegplot, residplot as buildResidplot } from '../dsl/regplot.ts';
export declare function regplot<const Id extends string = never>(data: RegData, opts?: RegOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildRegplot<Id>>, LaidOutChart>;
export declare function residplot<const Id extends string = never>(data: RegData, opts?: RegOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildResidplot<Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const regplotDefinition: BandDef<ChartBand, LaidOutChart>;
