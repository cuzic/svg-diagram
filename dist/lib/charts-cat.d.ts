import type { ChartGeom, ChartOpts, LaidOutChartPart } from './charts-base.ts';
import type { BoxStats, ErrorKind } from './stats.ts';
export type CatKind = 'box' | 'violin' | 'strip' | 'swarm' | 'point' | 'bar';
/** The function that draws a single kind, for the messages. */
export declare const FN: Record<CatKind, string>;
/** A group of values: its own, or one list per hue (a second category). */
export interface CatGroup {
    label: string;
    values?: readonly number[];
    hues?: readonly {
        name: string;
        values: readonly number[];
    }[];
    id?: string;
}
export interface CatOpts extends ChartOpts {
    /** The layers, drawn in this order (default 'box'). `['violin', 'strip']` lays the points over the violins. */
    kind?: CatKind | readonly CatKind[];
    /** 'v': the groups along the bottom (default); 'h': down the left. */
    dir?: 'v' | 'h';
    /** The name of the value axis. */
    label?: string;
    unit?: string;
    /** The error bar of `point` and `bar`: the 95% confidence interval of the mean (default), ±1 standard deviation / standard error, the full range, or none. */
    error?: ErrorKind;
    /** Write each group's median / mean beside it (`bar` writes the mean by default). */
    values?: 'median' | 'mean' | 'none';
    /** Write `n = …` under each group's name. */
    counts?: boolean;
    /** `violin`: every violin as wide as the slot allows ('width'), or the areas comparable (default 'area': a spread-out group is wider and flatter). */
    scale?: 'area' | 'width';
}
interface Series {
    name: string;
    values: number[];
    n: number;
    mean: number;
    box: BoxStats;
    err?: [number, number];
}
export interface CatSpec {
    groups: {
        label: string;
        id?: string;
        series: (Series | undefined)[];
    }[];
    hues: string[];
    kinds: CatKind[];
    dir: 'v' | 'h';
    label: string;
    unit: string;
    error: ErrorKind;
    values: 'median' | 'mean' | 'none';
    counts: boolean;
    scale: 'area' | 'width';
}
export declare function resolveCat(who: string, data: readonly CatGroup[] | Readonly<Record<string, readonly number[]>>, opts: CatOpts, defaultKind?: CatKind): CatSpec;
export declare function catAlt(s: CatSpec): string;
export declare function catTexts(s: CatSpec): [string, number][];
export type Shape = 'disc' | 'diamond' | 'square' | 'triangle' | 'ring';
export declare const SHAPES: Shape[];
export declare function markerPath(shape: Shape, x: number, y: number, r: number): string;
export declare function layoutCat(s: CatSpec, g: ChartGeom): LaidOutChartPart;
export {};
