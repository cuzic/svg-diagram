import type { ComboOpts, ComboSeries } from '../charts-combo.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { ChartIds } from './chart-ids.ts';
export declare function comboBand(categories: readonly string[], series: readonly ComboSeries[], opts: ComboOpts): ChartBand;
/**
 * A combo chart (コンボチャート / 複合グラフ): bars (left axis) and lines (right axis by default) over the same categories; `stack: true` piles the bars.
 *   combo(['2022', '2023', '2024'], [{label: '売上', type: 'bar', values: [120, 150, 190]}, {label: '営業利益率', type: 'line', values: [8, 9.5, 12]}], {y: {unit: '億円'}, y2: {unit: '%'}})
 */
export declare function combo<const S extends readonly ComboSeries[], const Id extends string = never>(categories: readonly string[], series: S, opts?: ComboOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
