import type { ArrowActivity } from '../qc.ts';
import type { WhyNode, StatesBand, StatesOpts, CauseBand, CauseOpts } from '../types/diagrams.ts';
import type { CaptionBand } from '../types/text-bands.ts';
import type { Declares, HandleOf } from '../strict.ts';
export { tree, mindmap } from './tree.ts';
export { bpmn } from './bpmn.ts';
export { classDiagram } from './classes.ts';
export { flowchart, stateDiagram } from './states.ts';
export { causeTree, pdpc, relationDiagram, transitionUnits } from './cause.ts';
export type { PdpcNode, PdpcLink, RelationNode, RelationOpts, TransitionUnit } from './cause.ts';
export interface WhyWhyTreeOpts extends Pick<CauseOpts, 'id' | 'maxNodeW' | 'reveal' | 'until' | 'scope'> {
    /** Leave out the lines under the tree that say how to read it (default: they are there). */
    readingNote?: boolean;
}
/**
 * A why-why analysis (なぜなぜ分析) as a tree, drawn by causeTree(): the problem at the top, each "なぜ?" answer below the one it explains, the root cause
 * (`trueCause: true`) in a double frame, and what is done about it (`measure`) as a dashed box that cuts it. Arrows run cause -> effect (up to the problem);
 * "なぜ?" reads against them, downward. Returns the tree and two lines that say so: pass them to add(). Written as a table: whyWhyTable().
 *   whyWhyTree('リリースが遅れた', [{why: '修正に時間がかかった', because: [
 *     {why: '影響範囲が広かった', because: [{why: '検証が最後に集中していた', trueCause: true, measure: '結合テストを毎週回す'}]},
 *     {why: '不具合の発見が遅かった'}]}])
 */
export declare function whyWhyTree<const Id extends string>(problem: string, whys: readonly WhyNode[], opts: WhyWhyTreeOpts & {
    id: Id;
}): [CauseBand & Declares<Id | `${Id}.problem` | `${Id}.w${string}`> & HandleOf<Id>, ...CaptionBand[]];
export declare function whyWhyTree(problem: string, whys: readonly WhyNode[], opts?: WhyWhyTreeOpts): (CauseBand | CaptionBand)[];
export { bowtie } from './bowtie.ts';
export interface ArrowDiagramOpts extends Omit<StatesOpts, 'initial' | 'dir'> {
    /** 'right' (default): the network runs left to right; 'down': top to bottom, for a long chain of events that does not fit the width. */
    dir?: 'right' | 'down';
    /** Write the earliest and latest time under each event's number ("5/7"), and the float on activities that are not critical (default true). */
    times?: boolean;
    /** The unit of the time, written in the line under the figure (default '日'). */
    unit?: string;
    /** A line under the figure with the length of the project and the critical path (default true). */
    summary?: boolean;
}
/**
 * An arrow diagram (アロー・ダイヤグラム; PERT): events are circles, activities are the arrows between them, each labelled with its name and
 * days, and a dummy (`dummy: true`, dashed) only says "this before that". The earliest and latest time of every event, the float of every
 * activity and the critical path are worked out: critical activities are thick red arrows and critical events are red.
 * In each circle: the event number, and under it the earliest / latest time. Exactly one event starts the network and one ends it.
 *   arrowDiagram([{from: 1, to: 2, name: '設計', days: 5}, {from: 2, to: 3, name: '製作', days: 7}, {from: 2, to: 3, dummy: true}, {from: 3, to: 4, name: '検査', days: 2}])
 */
export declare function arrowDiagram(activities: readonly ArrowActivity[], opts?: ArrowDiagramOpts): (StatesBand | CaptionBand)[];
export { affinity } from './affinity.ts';
export type { AffinityGroup, AffinityOpts } from './affinity.ts';
export { cloud } from './cloud.ts';
export { faultTree } from './fta.ts';
