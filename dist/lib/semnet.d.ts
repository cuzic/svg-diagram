import type { LaidOutChartPart, ChartGeom } from './charts-base.ts';
import type { PertAnalysis, PertTask } from './semnet-analysis.ts';
import type { SemnetDirection, SemnetOpts } from './semnet-common.ts';
import type { CausalSpec } from './semnet-causal.ts';
export { causalAlt, layoutCausal, resolveCausal } from './semnet-causal.ts';
export type { CausalSpec, CausalNode, CausalOpts, CausalIntervention } from './semnet-causal.ts';
export type { SemnetDirection } from './semnet-common.ts';
export interface PertOpts extends SemnetOpts {
    unit?: string;
    compact?: boolean;
}
export interface DependencyNode {
    id: string;
    label: string;
    kind?: string;
}
export type DependencyEdgeType = 'depends' | 'uses' | 'blocks' | 'relates' | (string & {});
export interface DependencyEdge {
    from: string;
    to: string;
    type: DependencyEdgeType;
    weight?: number;
    label?: string;
}
export interface DependencyOpts extends SemnetOpts {
    nodeKinds?: Record<string, string>;
    edgeTypes?: Record<string, string>;
}
export interface PertSpec {
    tasks: PertTask[];
    analysis: PertAnalysis;
    direction: SemnetDirection;
    unit: string;
    compact: boolean;
    straighten: boolean;
}
export interface DependencySpec {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    direction: SemnetDirection;
    nodeKinds: Record<string, string>;
    edgeTypes: Record<string, string>;
    straighten: boolean;
}
export declare function resolvePert(tasks: readonly PertTask[], opts?: PertOpts): PertSpec;
export declare function resolveDependency(nodes: readonly DependencyNode[], edges: readonly DependencyEdge[], opts?: DependencyOpts): DependencySpec;
export declare const pertAlt: (s: PertSpec) => string;
export declare const dependencyAlt: (s: DependencySpec) => string;
export declare function semnetTexts(kind: 'pert' | 'causal' | 'dependency', spec: PertSpec | CausalSpec | DependencySpec): [string, number][];
export declare function layoutPert(s: PertSpec, g: ChartGeom): LaidOutChartPart;
export declare function layoutDependency(s: DependencySpec, g: ChartGeom): LaidOutChartPart;
