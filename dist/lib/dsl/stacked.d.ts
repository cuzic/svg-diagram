import type { StackColumn, StackedOpts } from '../charts-stacked.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { StackMode } from '../charts-stacked.ts';
import type { ChartIds } from './chart-ids.ts';
export declare function stackedBand(who: string, columns: readonly StackColumn[], mode: StackMode, opts: StackedOpts): ChartBand;
/**
 * Stacked columns (積み上げ棒グラフ): each column cut into its parts, a number in every part; `percent: true` makes 100% columns.
 *   stackedBars([{label: '2023', parts: [{label: '国内', value: 60}, {label: '海外', value: 40}]}, ...], {unit: '億円'})
 */
export declare function stackedBars<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: StackedOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<C>> & HandleOf<Id> & AnchorsOf<ChartIds<C>>;
/**
 * A mekko chart (マリメッコ図): the width of a column is its total, the height of a part its share of the column — so the area of a
 * part is its share of the whole. Every part prints its share; one too small for the number is left out and stays in the description.
 *   mekko([{label: 'A 社', parts: [{label: '製品', value: 70}, {label: '保守', value: 30}]}, ...], {unit: '億円'})
 */
export declare function mekko<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: Omit<StackedOpts, 'percent'> & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<C>> & HandleOf<Id> & AnchorsOf<ChartIds<C>>;
