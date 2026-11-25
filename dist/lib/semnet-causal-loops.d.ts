/** Pure analyses for semantic networks. No layout, fonts or SVG. */
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
