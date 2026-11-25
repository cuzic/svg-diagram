import type { BandDef, WithBandDef } from '../band-def.ts';
import type { DistGroup, DistOpts } from '../charts-dist.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { displot as buildDisplot, histplot as buildHistplot, kdeplot as buildKdeplot, ecdfplot as buildEcdfplot, rugplot as buildRugplot } from '../dsl/distplot.ts';
type DistData = readonly number[] | readonly DistGroup[] | Readonly<Record<string, readonly number[]>>;
export declare function displot<const D extends DistData, const Id extends string = never>(data: D, opts?: DistOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildDisplot<D, Id>>, LaidOutChart>;
export declare function histplot<const D extends DistData, const Id extends string = never>(data: D, opts?: Omit<DistOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildHistplot<D, Id>>, LaidOutChart>;
export declare function kdeplot<const D extends DistData, const Id extends string = never>(data: D, opts?: Omit<DistOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildKdeplot<D, Id>>, LaidOutChart>;
export declare function ecdfplot<const D extends DistData, const Id extends string = never>(data: D, opts?: Omit<DistOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildEcdfplot<D, Id>>, LaidOutChart>;
export declare function rugplot<const D extends DistData, const Id extends string = never>(data: D, opts?: Omit<DistOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildRugplot<D, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const distplotDefinition: BandDef<ChartBand, LaidOutChart>;
export {};
