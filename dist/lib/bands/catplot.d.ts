import type { BandDef, WithBandDef } from '../band-def.ts';
import type { CatGroup, CatOpts } from '../charts-cat.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { catplot as buildCatplot, boxplot as buildBoxplot, violinplot as buildViolinplot, stripplot as buildStripplot, swarmplot as buildSwarmplot, pointplot as buildPointplot, barplot as buildBarplot } from '../dsl/catplot.ts';
type CatData = readonly CatGroup[] | Readonly<Record<string, readonly number[]>>;
export declare function catplot<const D extends CatData, const Id extends string = never>(data: D, opts?: CatOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildCatplot<D, Id>>, LaidOutChart>;
export declare function boxplot<const D extends CatData, const Id extends string = never>(data: D, opts?: Omit<CatOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildBoxplot<D, Id>>, LaidOutChart>;
export declare function violinplot<const D extends CatData, const Id extends string = never>(data: D, opts?: Omit<CatOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildViolinplot<D, Id>>, LaidOutChart>;
export declare function stripplot<const D extends CatData, const Id extends string = never>(data: D, opts?: Omit<CatOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildStripplot<D, Id>>, LaidOutChart>;
export declare function swarmplot<const D extends CatData, const Id extends string = never>(data: D, opts?: Omit<CatOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildSwarmplot<D, Id>>, LaidOutChart>;
export declare function pointplot<const D extends CatData, const Id extends string = never>(data: D, opts?: Omit<CatOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildPointplot<D, Id>>, LaidOutChart>;
export declare function barplot<const D extends CatData, const Id extends string = never>(data: D, opts?: Omit<CatOpts, 'kind'> & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildBarplot<D, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const catplotDefinition: BandDef<ChartBand, LaidOutChart>;
export {};
