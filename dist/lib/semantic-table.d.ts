import type { MatrixMark } from './qc-table.ts';
import type { TableColumn, TableOpts, TableRow } from './types/sequence-table-swimlane.ts';
type CommonOpts = Pick<TableOpts, 'title' | 'width' | 'dense' | 'id' | 'reveal' | 'until'>;
export interface SemanticTableParts {
    columns: TableColumn[];
    rows: TableRow[];
    opts: TableOpts;
}
export type RaciLetter = 'R' | 'A' | 'C' | 'I';
export type RaciAssignment = RaciLetter | `${RaciLetter}/${RaciLetter}` | string;
export interface RaciOpts extends CommonOpts {
    corner?: string;
    /** Permit a task without an Accountable role. The normal exactly-one-A check is otherwise enforced. */
    allowNoA?: boolean;
    /** Add a final row spelling out the four letters. */
    legend?: boolean;
}
export declare function raciParts(tasks: readonly string[], roles: readonly string[], assignments: readonly (readonly RaciAssignment[])[], opts?: RaciOpts): SemanticTableParts & {
    emptyRoles: string[];
};
export interface FmeaRatings {
    s: number;
    o: number;
    d: number;
}
export interface FmeaRow extends FmeaRatings {
    item: string;
    mode: string;
    effect: string;
    cause: string;
    action: string;
    /** Ratings after the action. */
    after?: FmeaRatings;
}
export interface FmeaOpts extends CommonOpts {
    sort?: 'rpn';
    threshold?: number;
    midThreshold?: number;
    labels?: Partial<Record<'item' | 'mode' | 'effect' | 'cause' | 'action' | 's' | 'o' | 'd' | 'rpn' | 'afterS' | 'afterO' | 'afterD' | 'afterRpn', string>>;
}
export interface FmeaComputedRow extends FmeaRow {
    rpn: number;
    afterRpn?: number;
}
export declare function fmeaComputed(rows: readonly FmeaRow[]): FmeaComputedRow[];
export declare function fmeaParts(input: readonly FmeaRow[], opts?: FmeaOpts): SemanticTableParts & {
    computed: FmeaComputedRow[];
};
export interface QfdDemand {
    label: string;
    importance: number;
}
export interface QfdOpts extends CommonOpts {
    corner?: string;
    highlight?: boolean;
}
export interface QfdScores {
    raw: number[];
    relative: number[];
}
export declare function qfdScores(demands: readonly QfdDemand[], relations: readonly (readonly MatrixMark[])[], characteristicCount: number): QfdScores;
export declare function qfdParts(demands: readonly QfdDemand[], characteristics: readonly string[], relations: readonly (readonly MatrixMark[])[], opts?: QfdOpts): SemanticTableParts & {
    scores: QfdScores;
};
export interface JourneyStage {
    label: string;
}
export interface JourneyLane {
    id: string;
    label: string;
    cells: readonly (string | number)[];
}
export interface JourneyMapOpts extends CommonOpts {
    corner?: string;
    emotionRange?: readonly [number, number];
}
export declare function journeyMapParts(stagesIn: readonly (string | JourneyStage)[], lanes: readonly JourneyLane[], opts?: JourneyMapOpts): SemanticTableParts & {
    emotionCurve?: {
        row: number;
        values: number[];
        min: number;
        max: number;
    };
};
export type IsIsNotDim = 'what' | 'where' | 'when' | 'extent' | (string & {});
export interface IsIsNotInputRow {
    dim: IsIsNotDim;
    is: string;
    isNot: string; /** What sets IS apart from IS NOT. */
    distinct?: string; /** What changed recently, around that difference (a different question). */
    change?: string;
}
export interface IsIsNotOpts extends CommonOpts {
    labels?: Partial<Record<'dim' | 'is' | 'isNot' | 'distinct' | 'change', string>>;
}
export declare const isIsNotDimLabel: (dim: string) => string;
export declare function isIsNotParts(rows: readonly IsIsNotInputRow[], opts?: IsIsNotOpts): SemanticTableParts;
export interface IsIsNotHypothesisInput {
    text: string; /** One per row of the specification: can this cause explain that row's IS and IS NOT? */
    results: readonly ('yes' | 'ifAssumed' | 'no')[];
    assumes?: readonly string[];
}
export interface IsIsNotTestsOpts extends CommonOpts {
    labels?: Partial<Record<'hypothesis' | 'unexplained' | 'assumptions' | 'fewest', string>>;
}
export declare function isIsNotTestsParts(rows: readonly IsIsNotInputRow[], hypotheses: readonly IsIsNotHypothesisInput[], opts?: IsIsNotTestsOpts): SemanticTableParts & {
    hypotheses: IsIsNotHypothesisInput[];
};
export interface WhyWhyChain {
    whys: readonly string[]; /** The root cause this chain ends in (a sentence). */
    trueCause?: string; /** What is done about the root cause. */
    measure?: string;
}
export interface WhyWhyTableOpts extends CommonOpts {
    labels?: Partial<Record<'problem' | 'why' | 'trueCause' | 'measure', string>>;
}
export declare function whyWhyTableParts(problem: string, chains: readonly WhyWhyChain[], opts?: WhyWhyTableOpts): SemanticTableParts;
export {};
