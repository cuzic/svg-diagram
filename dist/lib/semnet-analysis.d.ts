/** Pure analyses for semantic networks. No layout, fonts or SVG. */
export interface PertTask {
    id: string;
    label: string;
    duration: number;
    predecessors?: readonly string[];
}
export interface PertResult extends PertTask {
    predecessors: string[];
    es: number;
    ef: number;
    ls: number;
    lf: number;
    slack: number;
    critical: boolean;
}
export interface PertAnalysis {
    tasks: PertResult[];
    duration: number;
    criticalPath: string[];
    criticalEdges: {
        from: string;
        to: string;
    }[];
}
export declare function analyzeCriticalPath(input: readonly PertTask[]): PertAnalysis;
export type CausalPolarity = '+' | '-' | 'same' | 'opposite';
export interface CausalLink {
    from: string;
    to: string;
    polarity: CausalPolarity;
    delay?: boolean;
    label?: string;
}
export interface CausalLoop {
    nodes: string[];
    linkIndexes: number[];
    negativeLinks: number;
    kind: 'R' | 'B';
}
/** All directed simple cycles, once each, ordered by node input order. */
export declare function analyzeCausalLoops(nodes: readonly string[], links: readonly CausalLink[]): CausalLoop[];
