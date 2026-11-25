import type { RadarOpts, RadarSeries } from '../charts-radar.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { ChartIds } from './chart-ids.ts';
export declare function radarBand(axes: readonly string[], series: readonly RadarSeries[], opts: RadarOpts): ChartBand;
/**
 * A radar chart (レーダーチャート): 3-12 axes, 1-4 series. A concentric grid carries the tick values; the series differ by line style
 * and marker shape, and the legend names them. `values: true` prints the value at each vertex.
 *   radar(['品質', '価格', '納期', '対応'], [{label: '自社', values: [4, 3, 5, 4]}, {label: '競合', values: [3, 5, 3, 2]}], {max: 5})
 */
export declare function radar<const S extends readonly RadarSeries[], const Id extends string = never>(axes: readonly string[], series: S, opts?: RadarOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
