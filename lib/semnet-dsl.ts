import type {ChartBand} from './charts.ts';
import type {CausalLink, PertTask} from './semnet-analysis.ts';
import {causalAlt, dependencyAlt, pertAlt, resolveCausal, resolveDependency, resolvePert} from './semnet.ts';
import type {CausalNode, CausalOpts, DependencyEdge, DependencyNode, DependencyOpts, PertOpts} from './semnet.ts';

const common = (opts: {id?: string; width?: number; height?: number; labelRole?: 'note' | 'banner' | 'stat'; reveal?: number; until?: number}) => ({...(opts.id === undefined ? {} : {id: opts.id}), ...(opts.width === undefined ? {} : {width: opts.width}), ...(opts.height === undefined ? {} : {height: opts.height}), ...(opts.labelRole === undefined ? {} : {labelRole: opts.labelRole}), ...(opts.reveal === undefined ? {} : {reveal: opts.reveal}), ...(opts.until === undefined ? {} : {until: opts.until})});
export function pertBand(tasks: readonly PertTask[], opts: PertOpts = {}): ChartBand { const spec = resolvePert(tasks, opts); return {type: 'chart', kind: 'pert', spec, alt: opts.alt ?? pertAlt(spec), ids: tasks.map(t => t.id), ...common(opts)}; }
export function causalBand(nodes: readonly CausalNode[], links: readonly CausalLink[], opts: CausalOpts = {}): ChartBand { const spec = resolveCausal(nodes, links, opts); return {type: 'chart', kind: 'causal', spec, alt: opts.alt ?? causalAlt(spec), ids: [...nodes.map(n => n.id), ...spec.interventions.map(v => v.id)], ...common(opts)}; }
export function dependencyBand(nodes: readonly DependencyNode[], edges: readonly DependencyEdge[], opts: DependencyOpts = {}): ChartBand { const spec = resolveDependency(nodes, edges, opts); return {type: 'chart', kind: 'dependency', spec, alt: opts.alt ?? dependencyAlt(spec), ids: nodes.map(n => n.id), ...common(opts)}; }
