import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { CauseBand, CauseLink, CauseNode, CauseOpts, CauseRole } from '../types/diagrams.ts';
type CauseIds<N extends readonly CauseNode[]> = Extract<N[number]['id'], string>;
export declare function causeTree<const N extends readonly CauseNode[], const Id extends string = never>(nodes: N, links: readonly CauseLink[], opts?: CauseOpts & {
    id?: Id;
}): CauseBand & Declares<Id | CauseIds<N>> & HandleOf<Id> & AnchorsOf<CauseIds<N>>;
/** One unit of a transition tree: the current reality (the first unit; the next ones start from the result before), a need and an action make a new reality. */
export interface TransitionUnit {
    /** The id of the unit's result; the other entities are `<id>.need`, `<id>.action` and, in the first unit, `<id>.current`. */
    id: string;
    /** The current reality: the first unit only (it is a `precondition`); a later unit starts from the result of the one before. */
    current?: string;
    need: string;
    action: string;
    result: string;
    /** The role of the result (default 'io'; the last one is often a 'goal'). */
    resultRole?: CauseRole;
}
/**
 * The entities and links of a transition tree written as units (current reality + need + action → new reality, the result being the next unit's current
 * reality): a 3-input AND for each unit, to be given to causeTree(nodes, links, {tree: 'tt'}).
 *   const {nodes, links} = transitionUnits([{id: 'u1', current: '受注順に着手している', need: '納期を守りたい', action: '着手の枠を決める', result: '仕掛りが見える'}, ...]);
 */
export declare function transitionUnits(units: readonly TransitionUnit[]): {
    nodes: CauseNode[];
    links: CauseLink[];
};
/** causeTree's body; pdpc() and relationDiagram() pass `base: 'down'` (their direction when `dir` is left out, from which they may also turn to 'right' to fit). */
export declare function causeBand(nodes: readonly CauseNode[], links: readonly CauseLink[], opts: CauseOpts, base?: 'down', unanchored?: readonly string[]): CauseBand;
export interface PdpcNode extends Omit<CauseNode, 'role'> {
    /** start / goal (double outline), step (default), risk (what could go wrong: a hexagon), measure (what to do if it does). */
    role?: 'start' | 'step' | 'risk' | 'measure' | 'goal';
}
export interface PdpcLink extends Omit<CauseLink, 'from'> {
    from: string;
}
/**
 * A PDPC (process decision program chart, 過程決定計画図): the way from the start to the goal, the things that could go wrong on the way
 * (risk, a hexagon) and what to do then (measure). The main path is solid; an arrow into or out of a risk or a measure is dashed.
 * Runs top to bottom (`dir: 'right'` for left to right, which needs a narrow `maxNodeW` when the way has many steps).
 *   pdpc([{id: 's', label: '着手', role: 'start'}, {id: 'a', label: '試作'}, {id: 'r', label: '強度が足りない', role: 'risk'}, {id: 'm', label: '材質を変える', role: 'measure'}, {id: 'g', label: '量産開始', role: 'goal'}],
 *        [{from: 's', to: 'a'}, {from: 'a', to: 'g'}, {from: 'a', to: 'r'}, {from: 'r', to: 'm'}, {from: 'm', to: 'a'}])
 */
export declare function pdpc<const N extends readonly PdpcNode[], const Id extends string = never>(nodes: N, links: readonly PdpcLink[], opts?: CauseOpts & {
    id?: Id;
}): CauseBand & Declares<Id | CauseIds<N>> & HandleOf<Id> & AnchorsOf<CauseIds<N>>;
export interface RelationNode extends CauseNode {
}
export interface RelationOpts extends CauseOpts {
    /** The ids of the problem (the result the diagram is about): marked as the effect to resolve. */
    problem?: string | readonly string[];
    /** Write how many arrows leave and enter each factor under its text (default true). */
    counts?: boolean;
}
/**
 * A relations diagram (連関図): the factors of a tangled problem and the arrows from cause to effect, which may go back and cross. It counts
 * the arrows of every factor ('出' leaving, '入' entering) and marks the factor with the most leaving arrows (2 or more) as the
 * key cause: the one to act on. `problem` names the result (red). A node's own `role` wins.
 *   relationDiagram([{id: 'late', label: '納期遅れ'}, {id: 'rush', label: '急ぎ作業'}, ...], [{from: 'rush', to: 'late'}, ...], {problem: 'late'})
 */
export declare function relationDiagram<const N extends readonly RelationNode[], const Id extends string = never>(nodes: N, links: readonly {
    from: string;
    to: string;
    line?: 'solid' | 'dashed' | 'dotted';
    back?: true;
    kind?: 'cause' | 'blocks';
}[], opts?: RelationOpts & {
    id?: Id;
}): CauseBand & Declares<Id | CauseIds<N>> & HandleOf<Id> & AnchorsOf<CauseIds<N>>;
export {};
