
import type {ClusterOpts} from '../charts-cluster.ts';
import type {ChartBand} from '../charts.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {withHandle} from './shared.ts';
import {clusterAlt, resolveCluster} from '../charts-cluster.ts';
import {chartBandOptions} from '../chart-band-options.ts';

function clusterBand(rows: readonly string[], cols: readonly string[], values: readonly (readonly number[])[], opts: ClusterOpts): ChartBand {
  const spec = resolveCluster(rows, cols, values, opts);
  return {type: 'chart', kind: 'clustermap', spec, alt: opts.alt ?? clusterAlt(spec), ids: [], ...chartBandOptions('clustermap', opts)};
}

/**
 * クラスタ付きヒートマップ (seaborn clustermap): a table whose rows and columns are put in the order of a hierarchical clustering (average linkage),
 * with the two dendrograms beside it. `scale: 'row' | 'col'` scales each row / column to 0..1 before clustering and shading.
 *   clustermap(['A 店', 'B 店', 'C 店'], ['朝', '昼', '夜'], [[3, 9, 4], [8, 2, 9], [4, 8, 3]], {unit: '件'})
 */
export function clustermap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly number[])[], opts: ClusterOpts & {id?: Id} = {}): ChartBand & Declares<Id> & HandleOf<Id> {
  return withHandle(clusterBand(rows, cols, values, opts), opts.id) as never;
}
