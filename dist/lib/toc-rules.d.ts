import type { CauseBand } from './types/diagrams.ts';
export type TocRule = 'toc-ude-count' | 'toc-parts' | 'toc-no-desired-result' | 'toc-source-has-cause' | 'toc-chain-only' | 'toc-orphan' | 'toc-cycle-undeclared' | 'toc-nbr-parts' | 'toc-nbr-no-tipping' | 'toc-nbr-tipping-not-and' | 'toc-nbr-trim-too-late' | 'toc-tt-unit' | 'toc-prt-bottom-not-action' | 'toc-prt-one-to-one' | 'toc-obstacle-phrase' | 'toc-mirror' | 'toc-injection-to-obstacle' | 'toc-role-indistinct';
export interface TocFinding {
    rule: TocRule;
    message: string; /** Fixed: this finding is always reported at this severity (`toc-obstacle-phrase`: a judgement on Japanese sentence endings, never a warning). */
    severity?: 'info';
}
/** The range of undesirable effects a current reality tree is built from (the guidance of the method, not a measure of the examples). */
export declare const UDE_RANGE: {
    readonly min: 5;
    readonly max: 10;
};
type TocBand = Pick<CauseBand, 'nodes' | 'links' | 'tree' | 'mirrorOf' | 'roleTags'> & {
    id?: string;
};
export declare function tocFindings(band: TocBand): TocFinding[];
export {};
