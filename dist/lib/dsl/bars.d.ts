import type { ScatterOpts, ScatterPoint } from '../qc-plane.ts';
import type { BarDatum, BarsBand, BarsOpts } from '../types/bars.ts';
import type { PlaneBand } from '../types/figures.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
type BarIds<D extends readonly BarDatum[]> = Extract<D[number]['id'], string>;
export declare function bars<const D extends readonly BarDatum[], const Id extends string = never>(data: D, opts?: BarsOpts & {
    id?: Id;
}): BarsBand & Declares<Id | BarIds<D>> & HandleOf<Id> & AnchorsOf<BarIds<D>>;
/** A bar for each item from its low to its high (a minimum and a maximum, a confidence interval): `rangeBars([{label: '開発', range: [3.2, 5.8]}], {unit: '万円'})`. The same as bars() with `range` data; the value text reads `3.2〜5.8万円`. */
export declare function rangeBars<const D extends readonly (Omit<BarDatum, 'value' | 'range'> & {
    range: readonly [lo: number, hi: number];
})[], const Id extends string = never>(items: D, opts?: BarsOpts & {
    id?: Id;
}): BarsBand & Declares<Id | BarIds<D & readonly BarDatum[]>> & HandleOf<Id> & AnchorsOf<BarIds<D & readonly BarDatum[]>>;
export interface ParetoOpts extends Omit<BarsOpts, 'dir' | 'stack' | 'cumulative' | 'lines' | 'vlines' | 'curve' | 'edges' | 'max'> {
    /** Keep the largest N items and fold the rest into `other`. */
    top?: number;
    /** The label of the fold-in item, always last whatever its size (default 'その他'). */
    other?: string;
    /** Draw a dashed line at this cumulative percent (default 80; `false`: none). */
    guide?: number | false;
    /** Colour the leading items that reach the guide percent (the vital few) and mute the rest (default true). */
    highlight?: boolean;
}
/**
 * A Pareto chart (パレート図): the items as bars in descending order, the "other" item last, and a cumulative line on a 0-100% axis
 * on the right. The items that reach 80% are coloured (`highlight: false` to keep one colour). `top: 5` folds the rest into 'その他'.
 *   pareto([{label: '傷', value: 42}, {label: '汚れ', value: 25}, {label: '欠け', value: 12}, {label: 'その他', value: 6}], {unit: '件'})
 */
export declare function pareto<const Id extends string = never>(items: readonly {
    label: string;
    value: number;
    id?: string;
}[], opts?: ParetoOpts & {
    id?: Id;
}): BarsBand & Declares<Id> & HandleOf<Id>;
export interface HistogramOpts extends Omit<BarsOpts, 'dir' | 'stack' | 'cumulative' | 'lines' | 'vlines' | 'curve' | 'edges' | 'max' | 'barRatio'> {
    /** About how many classes (Sturges' rule when omitted). The class width is a round number. */
    bins?: number;
    /** The class width. */
    width?: number;
    /** Specification limits: dashed lines, and the classes beyond them are red. */
    lsl?: number;
    usl?: number;
    /** A target (nominal) value line. */
    target?: number;
    /** Draw the mean (default true). */
    mean?: boolean;
    /** Draw the normal curve with the data's mean and standard deviation. */
    normal?: boolean;
}
/**
 * A histogram (ヒストグラム) of raw measurements: the class width is a round number, the bars touch, the class boundaries are written
 * under the bars. `lsl` / `usl` draw the specification limits and turn the classes outside them red; the mean is drawn by default.
 *   histogram([9.8, 10.1, 10.0, 10.3, 9.9, ...], {lsl: 9.5, usl: 10.5, unit: '個'})
 */
export declare function histogram<const Id extends string = never>(values: readonly number[], opts?: HistogramOpts & {
    id?: Id;
}): BarsBand & Declares<Id> & HandleOf<Id>;
/**
 * A scatter diagram (散布図): the axes fit the data, each stratum (`group`) has its own colour and shape, and `regression: true` draws
 * the least-squares line with the correlation coefficient r.
 *   scatter([{x: 20, y: 3.1}, {x: 25, y: 3.8}, ...], {x: '温度 (℃)', y: '不良率 (%)', regression: true})
 */
export declare function scatter<const Id extends string = never>(points: readonly ScatterPoint[], opts: ScatterOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
export {};
