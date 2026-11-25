import type {TreemapNode, TreemapOpts} from '../charts-treemap.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import type {TreeIds} from './shared.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {resolveTreemap, treemapAlt} from '../charts-treemap.ts';

export function treemapBand(tree: TreemapNode | readonly TreemapNode[], opts: TreemapOpts): ChartBand {
  const spec = resolveTreemap(tree, opts);
  const ids: string[] = [];
  const walk = (n: TreemapNode): void => { if (n.id) ids.push(n.id); n.children?.forEach(walk); };
  spec.nodes.forEach(walk);
  return {type: 'chart', kind: 'treemap', spec, alt: opts.alt ?? treemapAlt(spec), ids, ...chartBandOptions('treemap', opts)};
}

/**
 * A treemap (ツリーマップ): a tree of values as nested rectangles with areas proportional to the values (squarified). Every cell prints its
 * name and value when they fit; one too small is drawn without a label and listed in the description (`strict: true`: an error).
 *   treemap([{label: '国内', children: [{label: '東京', value: 40}, {label: '大阪', value: 22}]}, {label: '海外', value: 30}], {unit: '億円'})
 */
export function treemap<const T extends TreemapNode | readonly TreemapNode[], const Id extends string = never>(tree: T, opts?: TreemapOpts & {id?: Id}): ChartBand & Declares<Id | TreeIds<T extends readonly (infer E)[] ? E : T>> & HandleOf<Id> & AnchorsOf<TreeIds<T extends readonly (infer E)[] ? E : T>>;
export function treemap(tree: TreemapNode | readonly TreemapNode[], opts: TreemapOpts = {}): ChartBand {
  const band = treemapBand(tree, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
