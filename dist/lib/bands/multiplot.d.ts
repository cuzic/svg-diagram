import type { BandDef, WithBandDef } from '../band-def.ts';
import type { MultiOpts, XY } from '../charts-multi.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { hist2d as buildHist2d, jointplot as buildJointplot, kde2d as buildKde2d, pairplot as buildPairplot } from '../dsl/multiplot.ts';
export declare function hist2d<const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildHist2d<Id>>, LaidOutChart>;
export declare function jointplot<const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildJointplot<Id>>, LaidOutChart>;
export declare function kde2d<const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildKde2d<Id>>, LaidOutChart>;
export declare function pairplot<const Id extends string = never>(data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildPairplot<Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const multiplotDefinition: BandDef<ChartBand, LaidOutChart>;
