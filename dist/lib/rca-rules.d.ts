import type { RcaFinding } from './types/core.ts';
import type { BowtieBand, WhyNode } from './types/diagrams.ts';
export interface IsIsNotRow {
    dim: string;
    is: string;
    isNot: string;
    distinct?: string;
    change?: string;
}
export interface IsIsNotHypothesis {
    text: string;
    results: readonly ('yes' | 'ifAssumed' | 'no')[];
    assumes?: readonly string[];
}
/** isisnot-no-isnot, isisnot-no-distinct-at-all: the specification table (what / where / when / extent). */
export declare function isIsNotFindings(rows: readonly IsIsNotRow[], dimLabel: (dim: string) => string): RcaFinding[];
/** The number of rows a hypothesis cannot explain. */
export declare const unexplained: (h: Pick<IsIsNotHypothesis, 'results'>) => number;
/** The hypotheses that explain every row (no `no`), and, of those, the ones with the fewest assumptions. */
export declare function standingHypotheses(hs: readonly IsIsNotHypothesis[]): {
    standing: Set<number>;
    fewest: Set<number>;
};
/** isisnot-no-hypothesis-stands: every hypothesis fails a row. Always info. */
export declare function isIsNotTestFindings(hs: readonly IsIsNotHypothesis[]): RcaFinding[];
export interface WhyChain {
    whys: readonly string[];
    trueCause?: string;
    measure?: string;
}
/** The checks of the why-why table: a row is one chain. */
export declare function whyWhyTableFindings(chains: readonly WhyChain[]): RcaFinding[];
/** The checks of the why-why tree: the same rules as the table, on the nodes. */
export declare function whyWhyTreeFindings(whys: readonly WhyNode[]): RcaFinding[];
/** bowtie-barrier-missing: a threat or a consequence with no barrier at all. */
export declare function bowtieFindings(band: Pick<BowtieBand, 'threats' | 'consequences'>): RcaFinding[];
