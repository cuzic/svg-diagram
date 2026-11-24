import type {ChartBand} from '../charts.ts';
import {dependencyAlt, resolveDependency} from '../semnet-dependency.ts';
import {semnetBandOptions} from '../semnet-band-options.ts';
import type {DependencyEdge, DependencyNode, DependencyOpts} from '../semnet.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import type {ChartIds} from './chart-ids.ts';

function dependencyBand(nodes: readonly DependencyNode[], edges: readonly DependencyEdge[], opts: DependencyOpts = {}): ChartBand {
  const spec = resolveDependency(nodes, edges, opts);
  return {type: 'chart', kind: 'dependency', spec, alt: opts.alt ?? dependencyAlt(spec), ids: nodes.map(n => n.id), ...semnetBandOptions(opts)};
}

/** A typed / weighted dependency network with an automatic notation legend. */
export function dependencyNetwork<const N extends readonly DependencyNode[], const Id extends string = never>(nodes: N, edges: readonly DependencyEdge[], opts?: DependencyOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<N>> & HandleOf<Id> & AnchorsOf<ChartIds<N>>;
export function dependencyNetwork(nodes: readonly DependencyNode[], edges: readonly DependencyEdge[], opts: DependencyOpts = {}): ChartBand {
  const band = dependencyBand(nodes, edges, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
