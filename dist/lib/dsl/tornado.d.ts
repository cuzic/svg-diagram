import type { TornadoItem, TornadoOpts } from '../charts-tornado.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { ChartIds } from './chart-ids.ts';
export declare function tornadoBand(items: readonly TornadoItem[], opts: TornadoOpts): ChartBand;
/**
 * A tornado chart (トルネード図): the result in the low and the high case of each input, as two bars from the base result, the input
 * the result is most sensitive to first. Values are printed at the ends of the bars.
 *   tornado([{label: '原材料費', low: 850, high: 1150}, {label: '為替', low: 940, high: 1060}], {base: 1000, unit: '百万円'})
 */
export declare function tornado<const I extends readonly TornadoItem[], const Id extends string = never>(items: I, opts: TornadoOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<I>> & HandleOf<Id> & AnchorsOf<ChartIds<I>>;
