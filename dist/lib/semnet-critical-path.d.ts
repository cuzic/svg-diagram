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
