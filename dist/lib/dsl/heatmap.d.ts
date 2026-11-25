import type { HeatmapOpts } from '../charts-heatmap.ts';
import type { ChartBand } from '../charts.ts';
import type { Declares, HandleOf } from '../strict.ts';
export declare function heatmapBand(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts: HeatmapOpts): ChartBand;
/**
 * A heatmap (ヒートマップ / コホート表): a table of numbers, each cell shaded by its size in a few steps; the number is always printed.
 * `null` is an empty cell (the unreached part of a cohort triangle).
 *   heatmap(['1月', '2月'], ['0', '1', '2'], [[100, 62, 48], [100, 58, null]], {unit: '%', corner: '登録月 ＼ 経過月'})
 */
export declare function heatmap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts?: HeatmapOpts & {
    id?: Id;
}): ChartBand & Declares<Id> & HandleOf<Id>;
