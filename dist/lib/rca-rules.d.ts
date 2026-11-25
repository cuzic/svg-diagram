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
export declare const rcaRules: Readonly<{
    readonly 'isisnot-no-isnot': {
        readonly doc: 'IS/IS NOT 表(isIsNot)に、IS NOT が空の行がある(比較対象が無い)。diagram({rcaCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'isisnot-no-distinct-at-all': {
        readonly doc: 'IS/IS NOT 表に「違い」が 1 つも無い(IS と IS NOT で鋭く違う点を挙げる)。diagram({rcaCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'isisnot-no-hypothesis-stands': {
        readonly doc: '仮説の検定表(isIsNotTests)に、説明できない行が 0 の仮説が無い(原因はまだ分かっていない。常に info)';
        readonly scope: 'band';
    };
    readonly 'whywhy-no-root': {
        readonly doc: 'なぜなぜ分析(whyWhyTable / whyWhyTree)に、真因(trueCause)の無い鎖(葉)がある。どこまで掘ったか分からない。diagram({rcaCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'whywhy-measure-without-root': {
        readonly doc: 'なぜなぜ分析で、真因でない所に対策(measure)がある(症状への対策になる)。diagram({rcaCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'whywhy-single-chain': {
        readonly doc: 'なぜなぜ分析が 1 本の鎖だけ(分岐が無い。原因が 1 つに決まっているか確かめる。常に info)';
        readonly scope: 'band';
    };
    readonly 'whywhy-dig-below-root': {
        readonly doc: 'なぜなぜの木で、真因(trueCause)の節の下にまだ「なぜ」がある(真因より下を掘っている。常に info)';
        readonly scope: 'band';
    };
    readonly 'bowtie-barrier-missing': {
        readonly doc: 'ボウタイ図(bowtie)で、脅威または結果にバリアが 1 つも無い(防ぐ・和らげる手が無い道)。diagram({rcaCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
}>;
