import type { TreemapNode, TreemapOpts } from '../charts-treemap.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { TreeIds } from './shared.ts';
export declare function treemapBand(tree: TreemapNode | readonly TreemapNode[], opts: TreemapOpts): ChartBand;
/**
 * A treemap (ツリーマップ): a tree of values as nested rectangles with areas proportional to the values (squarified). Every cell prints its
 * name and value when they fit; one too small is drawn without a label and listed in the description (`strict: true`: an error).
 *   treemap([{label: '国内', children: [{label: '東京', value: 40}, {label: '大阪', value: 22}]}, {label: '海外', value: 30}], {unit: '億円'})
 */
export declare function treemap<const T extends TreemapNode | readonly TreemapNode[], const Id extends string = never>(tree: T, opts?: TreemapOpts & {
    id?: Id;
}): ChartBand & Declares<Id | TreeIds<T extends readonly (infer E)[] ? E : T>> & HandleOf<Id> & AnchorsOf<TreeIds<T extends readonly (infer E)[] ? E : T>>;
