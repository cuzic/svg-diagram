import type {HeatmapOpts} from '../charts-heatmap.ts';
import type {ChartBand} from '../charts.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {withHandle} from './shared.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {heatmapAlt, resolveHeatmap} from '../charts-heatmap.ts';

export function heatmapBand(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts: HeatmapOpts): ChartBand {
  const spec = resolveHeatmap(rows, cols, values, opts);
  return {type: 'chart', kind: 'heatmap', spec, alt: opts.alt ?? heatmapAlt(spec), ids: [], ...chartBandOptions('heatmap', opts)};
}

/**
 * A heatmap (ヒートマップ / コホート表): a table of numbers, each cell shaded by its size in a few steps; the number is always printed.
 * `null` is an empty cell (the unreached part of a cohort triangle).
 *   heatmap(['1月', '2月'], ['0', '1', '2'], [[100, 62, 48], [100, 58, null]], {unit: '%', corner: '登録月 ＼ 経過月'})
 */
export function heatmap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts?: HeatmapOpts & {id?: Id}): ChartBand & Declares<Id> & HandleOf<Id>;
export function heatmap(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts: HeatmapOpts = {}): ChartBand {
  return withHandle(heatmapBand(rows, cols, values, opts), opts.id);
}
