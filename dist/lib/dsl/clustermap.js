import { withHandle } from './shared.js';
import { clusterAlt, resolveCluster } from '../charts-cluster.js';
import { chartBandOptions } from '../chart-band-options.js';
function clusterBand(rows, cols, values, opts) {
    const spec = resolveCluster(rows, cols, values, opts);
    return { type: 'chart', kind: 'clustermap', spec, alt: opts.alt ?? clusterAlt(spec), ids: [], ...chartBandOptions('clustermap', opts) };
}
/**
 * クラスタ付きヒートマップ (seaborn clustermap): a table whose rows and columns are put in the order of a hierarchical clustering (average linkage),
 * with the two dendrograms beside it. `scale: 'row' | 'col'` scales each row / column to 0..1 before clustering and shading.
 *   clustermap(['A 店', 'B 店', 'C 店'], ['朝', '昼', '夜'], [[3, 9, 4], [8, 2, 9], [4, 8, 3]], {unit: '件'})
 */
export function clustermap(rows, cols, values, opts = {}) {
    return withHandle(clusterBand(rows, cols, values, opts), opts.id);
}
