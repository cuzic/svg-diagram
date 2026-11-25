import type { ChartBand } from '../charts.ts';
import type { WaterfallOpts, WaterfallStep } from '../charts-waterfall.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { ChartIds } from './chart-ids.ts';
export declare function waterfallBand(steps: readonly WaterfallStep[], opts?: WaterfallOpts): ChartBand;
/**
 * A waterfall chart (ウォーターフォール図): a start value, the changes that lead from it, subtotals / a total. Bars float; an increase
 * rises from the level before it, a decrease hangs from it, connectors carry the level on. Every bar prints its value with its sign.
 *   waterfall([{label: '前期', value: 1000}, {label: '価格', value: 120}, {label: '数量', value: -80}, {label: '今期', kind: 'total'}], {unit: '万円'})
 */
export declare function waterfall<const S extends readonly WaterfallStep[], const Id extends string = never>(steps: S, opts?: WaterfallOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
