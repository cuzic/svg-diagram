import type { LaidOutChartPart, ChartGeom } from './charts-base.ts';
import type { SemnetDirection, SemnetOpts } from './semnet-common.ts';
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
export interface DependencySpec {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    direction: SemnetDirection;
    nodeKinds: Record<string, string>;
    edgeTypes: Record<string, string>;
    straighten: boolean;
}
export declare function resolveDependency(nodes: readonly DependencyNode[], edges: readonly DependencyEdge[], opts?: DependencyOpts): DependencySpec;
export declare const dependencyAlt: (s: DependencySpec) => string;
export declare function dependencyTexts(s: DependencySpec): [string, number][];
export declare function layoutDependency(s: DependencySpec, g: ChartGeom): LaidOutChartPart;
