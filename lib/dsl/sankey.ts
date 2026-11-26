import type {SankeyLink, SankeyNode, SankeyOpts} from '../charts-sankey.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {resolveSankey, sankeyAlt} from '../charts-sankey.ts';
import {resolveIcon} from '../icon-registry.ts';

export function sankeyBand(nodes: readonly (SankeyNode | string)[], links: readonly SankeyLink[], opts: SankeyOpts): ChartBand {
  // an icon is resolved here (the shell) and carried on the node, so layout and emit stay free of I/O
  const placed = nodes.map(n => typeof n === 'string' || n.icon === undefined ? n : {...n, iconGlyph: resolveIcon(n.icon, 'sankey() node "' + n.id + '" icon')});
  const spec = resolveSankey(placed, links, opts);
  return {type: 'chart', kind: 'sankey', spec, alt: opts.alt ?? sankeyAlt(spec), ids: spec.nodes.map(n => n.id), ...chartBandOptions('sankey', opts)};
}

/**
 * A Sankey diagram (サンキー図): flows between layers of nodes; the height of a node and the thickness of a ribbon are proportional to
 * the value. Nodes are layered from the sources, labels carry the values (values: false: names only), every node id is an anchor for connect() / spotlight.
 *   sankey(['広告', '自然検索', '訪問', '購入', '離脱'], [{from: '広告', to: '訪問', value: 60}, {from: '自然検索', to: '訪問', value: 40}, {from: '訪問', to: '購入', value: 15}, {from: '訪問', to: '離脱', value: 85}], {unit: '千人'})
 */
export function sankey<const N extends readonly (SankeyNode | string)[], const Id extends string = never>(nodes: N, links: readonly SankeyLink[], opts?: SankeyOpts & {id?: Id}): ChartBand & Declares<Id | SankeyIds<N>> & HandleOf<Id> & AnchorsOf<SankeyIds<N>>;
export function sankey(nodes: readonly (SankeyNode | string)[], links: readonly SankeyLink[], opts: SankeyOpts = {}): ChartBand {
  const band = sankeyBand(nodes, links, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
type SankeyIds<N extends readonly (SankeyNode | string)[]> = N[number] extends infer E ? E extends string ? E : E extends {id: infer I extends string} ? I : never : never;
