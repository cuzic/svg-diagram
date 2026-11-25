import type { SankeyLink, SankeyNode, SankeyOpts } from '../charts-sankey.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
export declare function sankeyBand(nodes: readonly (SankeyNode | string)[], links: readonly SankeyLink[], opts: SankeyOpts): ChartBand;
/**
 * A Sankey diagram (サンキー図): flows between layers of nodes; the height of a node and the thickness of a ribbon are proportional to
 * the value. Nodes are layered from the sources, labels carry the values, every node id is an anchor for connect() / spotlight.
 *   sankey(['広告', '自然検索', '訪問', '購入', '離脱'], [{from: '広告', to: '訪問', value: 60}, {from: '自然検索', to: '訪問', value: 40}, {from: '訪問', to: '購入', value: 15}, {from: '訪問', to: '離脱', value: 85}], {unit: '千人'})
 */
export declare function sankey<const N extends readonly (SankeyNode | string)[], const Id extends string = never>(nodes: N, links: readonly SankeyLink[], opts?: SankeyOpts & {
    id?: Id;
}): ChartBand & Declares<Id | SankeyIds<N>> & HandleOf<Id> & AnchorsOf<SankeyIds<N>>;
type SankeyIds<N extends readonly (SankeyNode | string)[]> = N[number] extends infer E ? E extends string ? E : E extends {
    id: infer I extends string;
} ? I : never : never;
export {};
