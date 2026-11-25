import type { ClusterOpts } from '../charts-cluster.ts';
import type { ChartBand } from '../charts.ts';
import type { Declares, HandleOf } from '../strict.ts';
/**
 * クラスタ付きヒートマップ (seaborn clustermap): a table whose rows and columns are put in the order of a hierarchical clustering (average linkage),
 * with the two dendrograms beside it. `scale: 'row' | 'col'` scales each row / column to 0..1 before clustering and shading.
 *   clustermap(['A 店', 'B 店', 'C 店'], ['朝', '昼', '夜'], [[3, 9, 4], [8, 2, 9], [4, 8, 3]], {unit: '件'})
 */
export declare function clustermap<const Id extends string = never>(rows: readonly string[], cols: readonly string[], values: readonly (readonly number[])[], opts?: ClusterOpts & {
    id?: Id;
}): ChartBand & Declares<Id> & HandleOf<Id>;
