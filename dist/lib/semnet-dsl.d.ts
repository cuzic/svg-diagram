import type { ChartBand } from './charts.ts';
import type { CausalLink, PertTask } from './semnet-analysis.ts';
import type { CausalNode, CausalOpts, DependencyEdge, DependencyNode, DependencyOpts, PertOpts } from './semnet.ts';
export declare function pertBand(tasks: readonly PertTask[], opts?: PertOpts): ChartBand;
export declare function causalBand(nodes: readonly CausalNode[], links: readonly CausalLink[], opts?: CausalOpts): ChartBand;
export declare function dependencyBand(nodes: readonly DependencyNode[], edges: readonly DependencyEdge[], opts?: DependencyOpts): ChartBand;
