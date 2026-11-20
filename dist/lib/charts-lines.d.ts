import type { PlaneBand, PlaneOpts, PlanePoint, PlaneTone } from './types/figures.ts';
import type { ChartOpts } from './charts-base.ts';
export interface LineSeries {
    label: string;
    /** One value per category (null: a gap), or [x, y] pairs for a numeric x axis. */
    values: readonly (number | null)[] | readonly (readonly [number, number])[];
    /** Draw it as the ideal / plan line: dashed, muted, no markers. */
    ideal?: boolean;
    /** Draw a smooth curve through the points (never overshoots them while x increases). */
    smooth?: boolean;
}
export interface LinesAxis {
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    ticks?: (number | {
        at: number;
        label: string;
    })[];
}
export interface LinesAnnotation {
    /** A position in the axes' units ([category index, y] on a category axis), or a series and the index of a point of it. */
    at: readonly [number, number] | {
        series: string;
        index: number;
    };
    label: string;
    tone?: PlaneTone;
    labelAt?: PlanePoint['labelAt'];
}
export interface LinesOpts extends Omit<ChartOpts, 'width' | 'alt'> {
    /** x: category names (`categories`), or a numeric axis. */
    x?: LinesAxis & {
        categories?: readonly string[];
    };
    y?: LinesAxis;
    /** A horizontal target line at this y value. */
    target?: {
        at: number;
        label?: string;
    };
    annotate?: readonly LinesAnnotation[];
    /** Markers on every point (default true). */
    markers?: boolean;
    /** Name each series at the right end of its line (default true; false: no names — the series then cannot be told apart). */
    endLabels?: boolean;
    grid?: boolean;
    width?: number;
}
export declare function linesOpts(series: readonly LineSeries[], opts?: LinesOpts): PlaneOpts;
export type { PlaneBand };
export interface StrategyCanvasOpts extends LinesOpts {
    /** The scale of the levels (default 0-5). */
    levels?: {
        min?: number;
        max?: number;
        low?: string;
        high?: string;
    };
}
/**
 * A strategy canvas (戦略キャンバス): the factors of competition along x, the level each company offers on each (low to high) on y; one line
 * per company. Series are given as {label, values: [one level per factor]}.
 */
export declare function strategyCanvasOpts(factors: readonly string[], series: readonly {
    label: string;
    values: readonly number[];
}[], opts?: StrategyCanvasOpts): [LineSeries[], LinesOpts];
export interface BurndownSpec {
    /** The work at the start (story points, hours, tickets). */
    total: number;
    /** The length of the period, in days (or whatever the x axis counts). */
    days: number;
    /** The work left at the end of each day, from day 0 (the start): `null` for days not yet reached. */
    actual: readonly (number | null)[];
}
/** A burndown chart (バーンダウン): the work left against the days, with the ideal straight line from the total to 0. */
export declare function burndownOpts(spec: BurndownSpec, opts?: LinesOpts): [LineSeries[], LinesOpts];
export interface BurnupSpec {
    /** The scope: one number (it never changes), or the scope at the end of each day (it may grow). */
    scope: number | readonly number[];
    days: number;
    /** The work done at the end of each day, from day 0. */
    done: readonly (number | null)[];
}
/** A burnup chart (バーンアップ): the work done climbing towards the scope line (which may move). */
export declare function burnupOpts(spec: BurnupSpec, opts?: LinesOpts): [LineSeries[], LinesOpts];
