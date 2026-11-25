import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { FlowEdge, FlowNode, FlowchartOpts, StateItem, StatesBand, StatesOpts, Transition } from '../types/diagrams.ts';
type StateIds<S extends readonly StateItem[]> = Extract<S[number]['id'], string>;
/**
 * A state diagram: states (boxes) and transitions (arrows) that place themselves in layers, flowing left to right
 * (dir: 'down' for top to bottom). A transition that goes back, skips a state or loops on itself is routed around the others.
 *   stateDiagram([{id: 'idle', label: '待機'}, {id: 'run', label: '実行中'}, {id: 'done', label: '完了', final: true}],
 *                [{from: 'idle', to: 'run', label: '開始'}, {from: 'run', to: 'idle', label: '中止'}, {from: 'run', to: 'done'}], {initial: 'idle'})
 */
export declare function stateDiagram<const S extends readonly StateItem[], const Id extends string = never>(states: S, transitions: readonly Transition[], opts?: StatesOpts & {
    id?: Id;
}): StatesBand & Declares<Id | StateIds<S>> & HandleOf<Id> & AnchorsOf<StateIds<S>>;
type FlowIds<N extends readonly FlowNode[]> = Extract<N[number]['id'], string>;
/**
 * A flowchart: steps, decisions (a diamond that holds the question) and start / end pills, joined by arrows; Yes / No go on the arrows that
 * leave a decision. It places itself like stateDiagram() and runs down unless `dir` says otherwise; a return to an earlier node goes round
 * the outside (`returns: 'outer'`). The question is wrapped inside the diamond, which grows with it.
 *   flowchart([{id: 's', kind: 'terminator', label: '相談'}, {id: 'q', kind: 'decision', label: '自分で答えられる？'}, {id: 'a', label: '回答する'}],
 *             [{from: 's', to: 'q'}, {from: 'q', to: 'a', label: 'Yes'}])
 */
export declare function flowchart<const N extends readonly FlowNode[], const Id extends string = never>(nodes: N, edges: readonly FlowEdge[], opts?: FlowchartOpts & {
    id?: Id;
}): StatesBand & Declares<Id | FlowIds<N>> & HandleOf<Id> & AnchorsOf<FlowIds<N>>;
export {};
