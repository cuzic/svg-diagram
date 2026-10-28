import type { ArrowActivity } from '../qc.ts';
import type { RowBand, GroupRowBand } from '../types/containers.ts';
import type { BowtieBand, BowtieInput, BowtieOpts, WhyNode, TreeBand, TreeItem, TreeOpts, MindmapOpts, StatesBand, StatesOpts, StateItem, Transition, FlowNode, FlowEdge, FlowchartOpts, CauseBand, FtaBand, FtaEvent, FtaOpts, CauseLink, CauseNode, CauseRole, CauseOpts, CloudBand, CloudBox, CloudOpts, ClassesBand, ClassesOpts, ClassItem, ClassRelation, BpmnBand, BpmnOpts, BpmnLane, BpmnNode, BpmnFlow } from '../types/diagrams.ts';
import type { CaptionBand } from '../types/text-bands.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { TreeIds } from './shared.ts';
/**
 * An org chart / hierarchy: the nodes place themselves (parent centred over its children, levels aligned). A node is
 * {label, sub?, id?, tone?, children?}; one with an id is an anchor for connect(), also as `t.anchors.<id>`.
 *   tree({label: '社長', sub: '代表取締役', children: [{label: '開発部', id: 'dev', children: [...]}, {label: '営業部'}]}, {dir: 'down'})
 */
export declare function tree<const R extends TreeItem, const Id extends string = never>(root: R, opts?: TreeOpts & {
    id?: Id;
}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
type BpmnIds<N extends readonly BpmnNode[]> = Extract<N[number]['id'], string>;
/**
 * A business process in lanes, BPMN-style: tasks, start / end events and gateways (xor / and / or), joined by flows
 * (a dashed flow is a message between lanes). Lanes are rows; the columns follow the flow.
 *   bpmn([{id: 'cust', label: '顧客'}, {id: 'shop', label: '店舗'}],
 *        [{id: 's', lane: 'cust', kind: 'start', label: '注文'}, {id: 'chk', lane: 'shop', label: '在庫確認'}, {id: 'g', lane: 'shop', kind: 'xor'}, {id: 'e', lane: 'shop', kind: 'end'}],
 *        [{from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'e', label: '在庫あり'}])
 */
export declare function bpmn<const N extends readonly BpmnNode[], const Id extends string = never>(lanes: readonly BpmnLane[], nodes: N, flows: readonly BpmnFlow[], opts?: BpmnOpts & {
    id?: Id;
}): BpmnBand & Declares<Id | BpmnIds<N>> & HandleOf<Id> & AnchorsOf<BpmnIds<N>>;
type ClassIds<C extends readonly ClassItem[]> = Extract<C[number]['id'], string>;
/**
 * A UML class diagram: classes ({id, name?, stereotype?, abstract?, attrs?, methods?}) and relations ({from, to, kind?, label?,
 * fromMult?, toMult?}), placed in layers with parents on top. `inherit` / `implement` run child -> parent (triangle at the parent);
 * `compose` / `aggregate` put the diamond on `from`, the whole.
 *   classDiagram([{id: 'Animal', abstract: true, methods: ['+ eat()']}, {id: 'Dog', attrs: ['- name: string']}],
 *                [{from: 'Dog', to: 'Animal', kind: 'inherit'}])
 */
export declare function classDiagram<const C extends readonly ClassItem[], const Id extends string = never>(classes: C, relations: readonly ClassRelation[], opts?: ClassesOpts & {
    id?: Id;
}): ClassesBand & Declares<Id | ClassIds<C>> & HandleOf<Id> & AnchorsOf<ClassIds<C>>;
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
/**
 * A bow-tie diagram (ボウタイ図): the top event (the loss of control) in the middle under its hazard; threats on the left, each through the
 * preventive barriers that stand between it and the top event; consequences on the right, each through the mitigating barriers. The flow
 * runs left to right. `maxNodeW` as for faultTree(): left out, a figure wider than the diagram is narrowed with a warning.
 *   bowtie({hazard: '顧客データ', top: '個人情報の漏えい',
 *           threats: [{label: '不正アクセス', barriers: ['多要素認証', 'アクセス制限']}, {label: '誤送信', barriers: ['送信前の確認']}],
 *           consequences: [{label: '信用の低下', barriers: ['広報対応']}, {label: '賠償', barriers: ['保険']}]})
 */
export declare function bowtie<const Id extends string = never>(input: BowtieInput, opts?: BowtieOpts & {
    id?: Id;
}): BowtieBand & Declares<Id> & HandleOf<Id>;
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
export interface AffinityGroup {
    /** The group's name (表札): what the cards in it have in common, in a short sentence. */
    title: string;
    /** The cards: one idea or fact each. */
    cards?: readonly string[];
    /** Groups inside this one (a larger group is made of smaller ones). */
    groups?: readonly AffinityGroup[];
}
export interface AffinityOpts {
    /** How many groups side by side (default 3). */
    cols?: number;
    /** How many cards side by side in a group (default 1). */
    cardCols?: number;
}
/**
 * An affinity diagram (親和図): cards of ideas or facts gathered into groups, each group named by a short sentence (its 表札), and
 * larger groups made of smaller ones. Groups sit side by side (`cols`), cards stack inside a group (`cardCols` to put them in columns).
 *   affinity([{title: '準備が足りない', cards: ['段取りが決まっていない', '資料が古い']}, {title: '連絡が遅い', groups: [{title: '社内', cards: ['報告が遅れる']}]}])
 */
export declare function affinity(groups: readonly AffinityGroup[], opts?: AffinityOpts): (RowBand | GroupRowBand)[];
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
type CloudIds<B> = B extends {
    id: infer I extends string;
} ? I : never;
/**
 * An Evaporating Cloud (conflict resolution diagram): A the common objective on the left, B and C the two needs, D and D' the two
 * wants that conflict (the red zigzag). Each arrow reads "in order to ..., we must ...". `assumptions` are numbered in the order
 * written, the number sits on the arrow they belong to (`on`: ab, ac, bd, cd, or dd for the conflict itself), and the list is under
 * the figure; an `injection` is the change that makes the assumption false.
 *   cloud({a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'},
 *         {assumptions: [{on: 'bd', text: '品質確保には長い検証期間が必須', injection: '自動テストで検証を短縮する'}]})
 */
export declare function cloud<const A extends CloudBox, const B extends CloudBox, const C extends CloudBox, const D extends CloudBox, const D2 extends CloudBox, const Id extends string = never>(boxes: {
    a: A;
    b: B;
    c: C;
    d: D;
    d2: D2;
}, opts?: CloudOpts & {
    id?: Id;
}): CloudBand & Declares<Id | CloudIds<A> | CloudIds<B> | CloudIds<C> | CloudIds<D> | CloudIds<D2>> & HandleOf<Id> & AnchorsOf<CloudIds<A> | CloudIds<B> | CloudIds<C> | CloudIds<D> | CloudIds<D2>>;
/**
 * A mind map: the root in the middle, its children split to the right and the left (balanced by height, in the order
 * written: the right side first), each branch growing outward. Nodes are the same as tree()'s; `sides` pins a child of the root.
 *   mindmap({label: '新機能', children: [{label: '目的', children: [...]}, {label: '課題', id: 'issues'}]}, {sides: {issues: 'left'}})
 */
export declare function mindmap<const R extends TreeItem, const Id extends string = never>(root: R, opts?: MindmapOpts & {
    id?: Id;
}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
/** The ids of a fault tree's events: its own, and those of every input and every inhibit condition below it. */
type FtaIds<T> = (T extends {
    readonly id: infer I extends string;
} ? I : never) | (T extends {
    readonly children: readonly (infer C)[];
} ? FtaIds<C> : never) | (T extends {
    readonly condition: infer C;
} ? FtaIds<C> : never);
/**
 * A fault tree (FTA): the top event, a gate under it (and / or / vote with k / inhibit) and the events that cause it, down to basic events (circle),
 * undeveloped events (diamond) and house events. Each event's text is a rectangle with the symbol of its kind under it; `{ref: id}` draws a
 * basic / undeveloped / house / condition event again. The lines have no arrowheads (they join a gate to its inputs: the tree reads downward).
 *   faultTree({label: 'サービス停止', gate: 'or', children: [
 *     {label: 'DB 全体停止', gate: 'and', children: [{label: '主系停止', kind: 'basic'}, {id: 'sw', label: '待機系へ切替不能', kind: 'basic'}]},
 *     {label: 'アプリ全台停止', kind: 'undeveloped'}]})
 */
export declare function faultTree<const T extends FtaEvent, const Id extends string = never>(top: T, opts?: FtaOpts & {
    id?: Id;
}): FtaBand & Declares<Id | FtaIds<T>> & HandleOf<Id> & AnchorsOf<FtaIds<T>>;
export {};
