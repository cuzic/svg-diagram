import {resolveIcon} from '../icon-registry.ts';
import {CAUSE_ROLES} from '../toc.ts';
import {coreDrivers, reachCounts} from '../toc-analysis.ts';
import {criticalPath, exact} from '../qc.ts';
import type {ArrowActivity} from '../qc.ts';
import type {GroupBand, RowBand, GroupRowBand} from '../types/containers.ts';
import type {TreeBand, TreeItem, TreeOpts, MindmapOpts, StatesBand, StatesOpts, StateItem, Transition, CauseBand, CauseLink, CauseNode, CauseOpts, CloudBand, CloudBox, CloudOpts, ClassesBand, ClassesOpts, ClassItem, ClassRelation, BpmnBand, BpmnOpts, BpmnLane, BpmnNode, BpmnFlow} from '../types/diagrams.ts';
import type {Band} from '../types/index.ts';
import type {CaptionBand} from '../types/text-bands.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {grid, row} from './containers.ts';
import {assertBoxTone, revealOf, withAnchors, withHandle} from './shared.ts';
import type {TreeIds} from './shared.ts';
import {box, caption, group} from './text-bands.ts';

/**
 * An org chart / hierarchy: the nodes place themselves (parent centred over its children, levels aligned). A node is
 * {label, sub?, id?, tone?, children?}; one with an id is an anchor for connect(), also as `t.anchors.<id>`.
 *   tree({label: '社長', sub: '代表取締役', children: [{label: '開発部', id: 'dev', children: [...]}, {label: '営業部'}]}, {dir: 'down'})
 */
export function tree<const R extends TreeItem, const Id extends string = never>(root: R, opts?: TreeOpts & {id?: Id}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
export function tree(root: TreeItem, opts: TreeOpts = {}): TreeBand {
  if (!root || typeof root !== 'object' || typeof root.label !== 'string') throw new Error('tree(root) needs a root node: {label: "...", children: [...]}');
  if (opts.dir !== undefined && opts.dir !== 'down' && opts.dir !== 'right') throw new Error(`tree(): dir must be 'down' or 'right' (got ${String(opts.dir)})`);
  if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW))) throw new Error(`tree(): maxNodeW must be a number >= 80 (got ${opts.maxNodeW})`);
  const ids: (string | undefined)[] = [];
  const walk = (n: TreeItem): void => {
    if (n.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(n.tone)) throw new Error(`tree(): "${n.label}" has tone ${String(n.tone)}`);
    ids.push(n.id);
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  const band: TreeBand = {type: 'tree', root, ...(opts.dir === undefined ? {} : {dir: opts.dir}), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), ids);
}
type BpmnIds<N extends readonly BpmnNode[]> = Extract<N[number]['id'], string>;
/**
 * A business process in lanes, BPMN-style: tasks, start / end events and gateways (xor / and / or), joined by flows
 * (a dashed flow is a message between lanes). Lanes are rows; the columns follow the flow.
 *   bpmn([{id: 'cust', label: '顧客'}, {id: 'shop', label: '店舗'}],
 *        [{id: 's', lane: 'cust', kind: 'start', label: '注文'}, {id: 'chk', lane: 'shop', label: '在庫確認'}, {id: 'g', lane: 'shop', kind: 'xor'}, {id: 'e', lane: 'shop', kind: 'end'}],
 *        [{from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'e', label: '在庫あり'}])
 */
export function bpmn<const N extends readonly BpmnNode[], const Id extends string = never>(lanes: readonly BpmnLane[], nodes: N, flows: readonly BpmnFlow[], opts?: BpmnOpts & {id?: Id}): BpmnBand & Declares<Id | BpmnIds<N>> & HandleOf<Id> & AnchorsOf<BpmnIds<N>>;
export function bpmn(lanes: readonly BpmnLane[], nodes: readonly BpmnNode[], flows: readonly BpmnFlow[], opts: BpmnOpts = {}): BpmnBand {
  if (!Array.isArray(lanes) || lanes.length === 0) throw new Error('bpmn(lanes, nodes, flows) needs at least one lane');
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('bpmn(lanes, nodes, flows) needs at least one node');
  for (const l of lanes) if (l.tone !== undefined) assertBoxTone(l.tone, `bpmn() lane "${l.id}"`);
  for (const n of nodes) if (n.tone !== undefined) {
    assertBoxTone(n.tone, `bpmn() node "${n.id}"`);
    if (!['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(n.tone)) throw new Error(`bpmn(): node "${n.id}" has tone ${String(n.tone)}`);
  }
  // an icon is resolved here (the shell) and carried on the node, so layout and emit stay free of I/O
  const placedNodes = nodes.map(n => n.icon === undefined ? n : {...n, iconGlyph: resolveIcon(n.icon, `bpmn() task "${n.id}" icon`)});
  for (const f of flows) if (f.line !== undefined && f.line !== 'solid' && f.line !== 'dashed') throw new Error(`bpmn(): flow ${f.from} -> ${f.to} has line ${String(f.line)}`);
  if (opts.fit !== undefined && opts.fit !== 'shrink') throw new Error(`bpmn(): fit must be 'shrink' (got ${String(opts.fit)})`);
  const band: BpmnBand = {type: 'bpmn', lanes: [...lanes], nodes: placedNodes, flows: [...flows], ...(opts.id === undefined ? {} : {id: opts.id}), ...(opts.fit === undefined ? {} : {fit: opts.fit}), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), nodes.map(n => n.id));
}
type ClassIds<C extends readonly ClassItem[]> = Extract<C[number]['id'], string>;
/**
 * A UML class diagram: classes ({id, name?, stereotype?, abstract?, attrs?, methods?}) and relations ({from, to, kind?, label?,
 * fromMult?, toMult?}), placed in layers with parents on top. `inherit` / `implement` run child -> parent (triangle at the parent);
 * `compose` / `aggregate` put the diamond on `from`, the whole.
 *   classDiagram([{id: 'Animal', abstract: true, methods: ['+ eat()']}, {id: 'Dog', attrs: ['- name: string']}],
 *                [{from: 'Dog', to: 'Animal', kind: 'inherit'}])
 */
export function classDiagram<const C extends readonly ClassItem[], const Id extends string = never>(classes: C, relations: readonly ClassRelation[], opts?: ClassesOpts & {id?: Id}): ClassesBand & Declares<Id | ClassIds<C>> & HandleOf<Id> & AnchorsOf<ClassIds<C>>;
export function classDiagram(classes: readonly ClassItem[], relations: readonly ClassRelation[], opts: ClassesOpts = {}): ClassesBand {
  if (!Array.isArray(classes) || classes.length === 0) throw new Error('classDiagram(classes, relations) needs at least one class');
  if (opts.dir !== undefined && opts.dir !== 'down' && opts.dir !== 'right' && opts.dir !== 'auto') throw new Error(`classDiagram(): dir must be 'down', 'right' or 'auto' (got ${String(opts.dir)})`);
  for (const c of classes) if (c.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(c.tone)) throw new Error(`classDiagram(): class "${c.id}" has tone ${String(c.tone)}`);
  const band: ClassesBand = {type: 'classes', classes: [...classes], relations: [...relations], ...(opts.dir === undefined ? {} : {dir: opts.dir}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), classes.map(c => c.id));
}
type StateIds<S extends readonly StateItem[]> = Extract<S[number]['id'], string>;
/**
 * A state diagram: states (boxes) and transitions (arrows) that place themselves in layers, flowing left to right
 * (dir: 'down' for top to bottom). A transition that goes back, skips a state or loops on itself is routed around the others.
 *   stateDiagram([{id: 'idle', label: '待機'}, {id: 'run', label: '実行中'}, {id: 'done', label: '完了', final: true}],
 *                [{from: 'idle', to: 'run', label: '開始'}, {from: 'run', to: 'idle', label: '中止'}, {from: 'run', to: 'done'}], {initial: 'idle'})
 */
export function stateDiagram<const S extends readonly StateItem[], const Id extends string = never>(states: S, transitions: readonly Transition[], opts?: StatesOpts & {id?: Id}): StatesBand & Declares<Id | StateIds<S>> & HandleOf<Id> & AnchorsOf<StateIds<S>>;
export function stateDiagram(states: readonly StateItem[], transitions: readonly Transition[], opts: StatesOpts = {}): StatesBand {
  if (!Array.isArray(states) || states.length === 0) throw new Error('stateDiagram(states, transitions) needs at least one state');
  if (opts.dir !== undefined && opts.dir !== 'right' && opts.dir !== 'down' && opts.dir !== 'auto') throw new Error(`stateDiagram(): dir must be 'right', 'down' or 'auto' (got ${String(opts.dir)})`);
  if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW))) throw new Error(`stateDiagram(): maxNodeW must be a number >= 80 (got ${opts.maxNodeW})`);
  if (opts.returns !== undefined && opts.returns !== 'inline' && opts.returns !== 'outer') throw new Error(`stateDiagram(): returns must be 'inline' or 'outer' (got ${String(opts.returns)})`);
  for (const t of transitions) if (t.line !== undefined && !['solid', 'dashed', 'dotted'].includes(t.line)) throw new Error(`stateDiagram(): transition ${t.from} -> ${t.to} has line ${String(t.line)}`);
  for (const s of states) if (s.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger'].includes(s.tone)) throw new Error(`stateDiagram(): state "${s.id}" has tone ${String(s.tone)} (use plain, accent, new, changed, removed, muted, danger, solid or solid-danger)`);
  for (const s of states) if (s.shape !== undefined && s.shape !== 'box' && s.shape !== 'circle') throw new Error(`stateDiagram(): state "${s.id}" has shape ${String(s.shape)} (use 'box' or 'circle')`);
  for (const t of transitions) if (t.tone !== undefined && !['danger', 'accent', 'muted'].includes(t.tone)) throw new Error(`stateDiagram(): transition ${t.from} -> ${t.to} has tone ${String(t.tone)} (use danger, accent or muted)`);
  const band: StatesBand = {type: 'states', states: states.map(s => s.icon === undefined ? s : {...s, iconGlyph: resolveIcon(s.icon, 'stateDiagram() state "' + s.id + '" icon')}), transitions: [...transitions], ...(opts.dir === undefined ? {} : {dir: opts.dir}), ...(opts.initial === undefined ? {} : {initial: opts.initial}), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.returns === undefined ? {} : {returns: opts.returns}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), states.map(s => s.id));
}
type CauseIds<N extends readonly CauseNode[]> = Extract<N[number]['id'], string>;
/**
 * A cause-and-effect tree of the Theory of Constraints: entities (boxes) and the arrows from cause to effect, placed in layers with
 * the causes at the bottom and the effects at the top (dir: 'down' / 'right' / 'left' turn it). The one figure behind the Current
 * and Future Reality Trees, the Prerequisite Tree and the Transition Tree: a link whose `from` is an array is an AND (the causes
 * together; an arc is drawn across their arrows), separate links are alternatives. `role` colours an entity: ude (undesirable
 * effect), root (root cause), de (desirable effect), injection, goal, obstacle, io (intermediate objective), action.
 *   causeTree([{id: 'late', label: '納期遅れ', role: 'ude'}, {id: 'multi', label: '並行作業が多い', role: 'root'}, {id: 'sw', label: '切替ロス'}],
 *             [{from: 'multi', to: 'sw'}, {from: 'sw', to: 'late'}])
 */
export function causeTree<const N extends readonly CauseNode[], const Id extends string = never>(nodes: N, links: readonly CauseLink[], opts?: CauseOpts & {id?: Id}): CauseBand & Declares<Id | CauseIds<N>> & HandleOf<Id> & AnchorsOf<CauseIds<N>>;
export function causeTree(nodes: readonly CauseNode[], links: readonly CauseLink[], opts: CauseOpts = {}): CauseBand {
  return causeBand(nodes, links, opts);
}
/** causeTree's body; pdpc() and relationDiagram() pass `base: 'down'` (their direction when `dir` is left out, from which they may also turn to 'right' to fit). */
function causeBand(nodes: readonly CauseNode[], links: readonly CauseLink[], opts: CauseOpts, base?: 'down'): CauseBand {
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('causeTree(nodes, links) needs at least one node');
  if (!Array.isArray(links)) throw new Error('causeTree(nodes, links): links must be an array');
  if (opts.dir !== undefined && !['up', 'down', 'right', 'left', 'auto'].includes(opts.dir)) throw new Error(`causeTree(): dir must be 'up', 'down', 'right', 'left' or 'auto' (got ${String(opts.dir)})`);
  if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW))) throw new Error(`causeTree(): maxNodeW must be a number >= 80 (got ${opts.maxNodeW})`);
  for (const l of links) if (l.line !== undefined && !['solid', 'dashed', 'dotted'].includes(l.line)) throw new Error(`causeTree(): link to ${l.to} has line ${String(l.line)}`);
  if (opts.returns !== undefined && opts.returns !== 'inline' && opts.returns !== 'outer') throw new Error(`causeTree(): returns must be 'inline' or 'outer' (got ${String(opts.returns)})`);
  for (const l of links) {
    if (l.kind !== undefined && l.kind !== 'cause' && l.kind !== 'blocks') throw new Error(`causeTree(): link to ${l.to} has kind ${String(l.kind)} (use 'cause' or 'blocks')`);
    if (l.kind === 'blocks' && typeof l.from !== 'string') throw new Error(`causeTree(): a 'blocks' link to ${l.to} needs one entity as its from (a string, not an AND)`);
    if (l.back === undefined) continue;
    if (l.back !== true) throw new Error(`causeTree(): link to ${l.to} has back ${String(l.back)} (write back: true, or leave it out)`);
    if (typeof l.from !== 'string') throw new Error(`causeTree(): a link to "${l.to}" is an AND (from is a list) and also back: true. A return is one arrow: write the link that returns on its own`);
  }
  for (const n of nodes) {
    if (n.role !== undefined && !(n.role in CAUSE_ROLES)) throw new Error(`causeTree(): node "${n.id}" has role ${String(n.role)} (use ${Object.keys(CAUSE_ROLES).join(', ')})`);
    if (n.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(n.tone)) throw new Error(`causeTree(): node "${n.id}" has tone ${String(n.tone)}`);
  }
  if (opts.tree !== undefined && !['crt', 'frt', 'prt', 'tt'].includes(opts.tree)) throw new Error(`causeTree(): tree must be 'crt', 'frt', 'prt' or 'tt' (got ${String(opts.tree)})`);
  if (opts.coreDriver !== undefined && typeof opts.coreDriver !== 'boolean') throw new Error(`causeTree(): coreDriver must be true or false (got ${String(opts.coreDriver)})`);
  const counted = opts.coreDriver ? reachCounts(nodes, links) : undefined, core = new Set(counted ? coreDrivers(counted) : []);
  const marked = counted ? nodes.map(n => !counted.has(n.id) ? n : {...n, ...(core.has(n.id) ? {core: true} : {}), ...(opts.counts === false ? {} : {sub: `${n.sub ? `${n.sub}　` : ''}到達 UDE ${counted.get(n.id)}`})}) : nodes;
  const band: CauseBand = {type: 'cause', nodes: [...marked], links: links.map(l => ({...l, ...(typeof l.from === 'string' ? {} : {from: [...l.from]})})), ...(opts.dir === undefined ? (base === undefined ? {} : {dir: base, dirLeftOut: true as const}) : {dir: opts.dir}), ...(base === undefined ? {} : {base}), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.tree === undefined ? {} : {tree: opts.tree}), ...(opts.returns === undefined ? {} : {returns: opts.returns}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), nodes.map(n => n.id));
}
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
export function arrowDiagram(activities: readonly ArrowActivity[], opts: ArrowDiagramOpts = {}): (StatesBand | CaptionBand)[] {
  const r = criticalPath(activities), unit = opts.unit ?? '日', show = opts.times !== false;
  const states: StateItem[] = r.events.map(e => ({id: e.id, label: e.id, shape: 'circle', ...(show ? {sub: `${exact(e.early)}/${exact(e.late)}`} : {}), ...(e.late - e.early < 1e-9 ? {tone: 'danger' as const} : {})}));
  const transitions: Transition[] = r.activities.map(a => ({
    from: a.from, to: a.to, ...(a.dummy ? {line: 'dashed' as const} : {label: `${a.name} ${exact(a.days)}${show && !a.critical && a.float > 0 ? `（余裕${exact(a.float)}）` : ''}`}),
    ...(a.critical ? {tone: 'danger' as const, strong: true} : {}),
  }));
  const {times: _t, unit: _u, summary, ...rest} = opts;
  const band = stateDiagram(states, transitions, {...rest, ...(opts.dir === undefined ? {} : {dir: opts.dir})}) as StatesBand;
  return summary === false ? [band] : [band, caption(`全体で ${exact(r.length)}${unit}　クリティカルパス: ${r.path.join(' → ')}${r.activities.filter(a => a.critical && !a.dummy).length > r.path.length ? '（ほかにも同じ長さの経路がある）' : ''}`, {align: 'left'})];
}
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
export function affinity(groups: readonly AffinityGroup[], opts: AffinityOpts = {}): (RowBand | GroupRowBand)[] {
  if (!Array.isArray(groups) || groups.length === 0) throw new Error('affinity(groups) needs at least one group');
  const cols = opts.cols ?? 3, cardCols = opts.cardCols ?? 1;
  for (const [k, v] of [['cols', cols], ['cardCols', cardCols]] as const) if (!(Number.isInteger(v) && v >= 1 && v <= 6)) throw new Error(`affinity(): ${k} must be a whole number from 1 to 6 (got ${v})`);
  const spanOf = (g: AffinityGroup, unit: number): number => Math.min(unit, Math.max(1, g.groups?.length ?? 1));
  // a group made of smaller groups is as many columns wide as it has of them, so the small ones are not squeezed
  const build = (g: AffinityGroup, depth: number, span: number, unit: number): GroupBand => {
    if (typeof g?.title !== 'string' || !g.title.trim()) throw new Error('affinity(): every group needs a title (its 表札)');
    const cards = (g.cards ?? []).map(t => {
      if (typeof t !== 'string' || !t.trim()) throw new Error(`affinity(): group "${g.title}" has an empty card`);
      return box({body: t, tone: 'plain'});
    });
    if (!cards.length && !g.groups?.length) throw new Error(`affinity(): group "${g.title}" has no cards and no groups`);
    const inner: Band[] = [...rows(g.groups ?? [], depth + 1, span), ...(cardCols > 1 && cards.length ? [grid(cards, {cols: cardCols})] : cards)];
    return group(inner, {title: g.title, tone: depth === 0 ? 'accent' : 'muted', dashed: false, ...(unit > 1 ? {span} : {})});
  };
  // rows of `unit` columns, groups packed in order
  const rows = (list: readonly AffinityGroup[], depth: number, unit: number): (RowBand | GroupRowBand)[] => {
    const out: (RowBand | GroupRowBand)[] = [];
    let cur: GroupBand[] = [], used = 0;
    const flush = (): void => { if (cur.length) out.push(row(cur, {cols: unit})); cur = []; used = 0; };
    for (const g of list) {
      const span = spanOf(g, unit);
      if (used + span > unit) flush();
      cur.push(build(g, depth, span, unit));
      used += span;
    }
    flush();
    return out;
  };
  return rows(groups, 0, cols);
}
export interface PdpcNode extends Omit<CauseNode, 'role'> {
  /** start / goal (double outline), step (default), risk (what could go wrong: a hexagon), measure (what to do if it does). */
  role?: 'start' | 'step' | 'risk' | 'measure' | 'goal';
}
export interface PdpcLink extends Omit<CauseLink, 'from'> {from: string}
/**
 * A PDPC (process decision program chart, 過程決定計画図): the way from the start to the goal, the things that could go wrong on the way
 * (risk, a hexagon) and what to do then (measure). The main path is solid; an arrow into or out of a risk or a measure is dashed.
 * Runs top to bottom (`dir: 'right'` for left to right, which needs a narrow `maxNodeW` when the way has many steps).
 *   pdpc([{id: 's', label: '着手', role: 'start'}, {id: 'a', label: '試作'}, {id: 'r', label: '強度が足りない', role: 'risk'}, {id: 'm', label: '材質を変える', role: 'measure'}, {id: 'g', label: '量産開始', role: 'goal'}],
 *        [{from: 's', to: 'a'}, {from: 'a', to: 'g'}, {from: 'a', to: 'r'}, {from: 'r', to: 'm'}, {from: 'm', to: 'a'}])
 */
export function pdpc<const N extends readonly PdpcNode[], const Id extends string = never>(nodes: N, links: readonly PdpcLink[], opts?: CauseOpts & {id?: Id}): CauseBand & Declares<Id | CauseIds<N>> & HandleOf<Id> & AnchorsOf<CauseIds<N>>;
export function pdpc(nodes: readonly PdpcNode[], links: readonly PdpcLink[], opts: CauseOpts = {}): CauseBand {
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('pdpc(nodes, links) needs at least one node');
  const side = new Set((Array.isArray(nodes) ? nodes : []).filter(n => n.role === 'risk' || n.role === 'measure').map(n => n.id));
  for (const n of nodes ?? []) if (n.role !== undefined && !['start', 'step', 'risk', 'measure', 'goal'].includes(n.role)) throw new Error(`pdpc(): node "${n.id}" has role ${String(n.role)} (use start, step, risk, measure or goal)`);
  const band = causeBand(nodes.map(n => ({...n, role: n.role ?? 'step'})), (links ?? []).map(l => ({...l, line: l.line ?? (side.has(l.from) || side.has(l.to) ? 'dashed' : 'solid')} as CauseLink)), opts, 'down');
  return opts.returns === undefined ? Object.assign(band, {returnsDefault: 'outer' as const}) : band;
}
export interface RelationNode extends CauseNode {}
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
export function relationDiagram<const N extends readonly RelationNode[], const Id extends string = never>(nodes: N, links: readonly {from: string; to: string; line?: 'solid' | 'dashed' | 'dotted'; back?: true; kind?: 'cause' | 'blocks'}[], opts?: RelationOpts & {id?: Id}): CauseBand & Declares<Id | CauseIds<N>> & HandleOf<Id> & AnchorsOf<CauseIds<N>>;
export function relationDiagram(nodes: readonly RelationNode[], links: readonly {from: string; to: string; line?: 'solid' | 'dashed' | 'dotted'; back?: true; kind?: 'cause' | 'blocks'}[], opts: RelationOpts = {}): CauseBand {
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('relationDiagram(nodes, links) needs at least one node');
  const ids = new Set(nodes.map(n => n.id)), problems = new Set(opts.problem === undefined ? [] : typeof opts.problem === 'string' ? [opts.problem] : opts.problem);
  for (const p of problems) if (!ids.has(p)) throw new Error(`relationDiagram(): problem names unknown node "${p}"`);
  for (const l of links ?? []) if (typeof l.from !== 'string') throw new Error(`relationDiagram(): a link to "${l.to}" needs one cause as a string (use causeTree() for an AND)`);
  const out = new Map(nodes.map(n => [n.id, (links ?? []).filter(l => l.kind !== 'blocks' && l.from === n.id).length])), into = new Map(nodes.map(n => [n.id, (links ?? []).filter(l => l.kind !== 'blocks' && l.to === n.id).length]));
  const top = Math.max(0, ...nodes.filter(n => !problems.has(n.id) && n.role === undefined).map(n => out.get(n.id)!));
  const {problem: _p, counts, ...rest} = opts;
  return causeBand(nodes.map(n => ({
    ...n,
    role: n.role ?? (problems.has(n.id) ? 'ude' : top >= 2 && out.get(n.id) === top ? 'root' : 'effect'),
    ...(counts === false ? {} : {sub: `${n.sub ? `${n.sub}　` : ''}出 ${out.get(n.id)}・入 ${into.get(n.id)}`}),
  })), (links ?? []).map(l => ({...l})), rest, 'down');
}
type CloudIds<B> = B extends {id: infer I extends string} ? I : never;
/**
 * An Evaporating Cloud (conflict resolution diagram): A the common objective on the left, B and C the two needs, D and D' the two
 * wants that conflict (the red zigzag). Each arrow reads "in order to ..., we must ...". `assumptions` are numbered in the order
 * written, the number sits on the arrow they belong to (`on`: ab, ac, bd, cd, or dd for the conflict itself), and the list is under
 * the figure; an `injection` is the change that makes the assumption false.
 *   cloud({a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'},
 *         {assumptions: [{on: 'bd', text: '品質確保には長い検証期間が必須', injection: '自動テストで検証を短縮する'}]})
 */
export function cloud<const A extends CloudBox, const B extends CloudBox, const C extends CloudBox, const D extends CloudBox, const D2 extends CloudBox, const Id extends string = never>(boxes: {a: A; b: B; c: C; d: D; d2: D2}, opts?: CloudOpts & {id?: Id}): CloudBand & Declares<Id | CloudIds<A> | CloudIds<B> | CloudIds<C> | CloudIds<D> | CloudIds<D2>> & HandleOf<Id> & AnchorsOf<CloudIds<A> | CloudIds<B> | CloudIds<C> | CloudIds<D> | CloudIds<D2>>;
export function cloud(boxes: {a: CloudBox; b: CloudBox; c: CloudBox; d: CloudBox; d2: CloudBox}, opts: CloudOpts = {}): CloudBand {
  for (const k of ['a', 'b', 'c', 'd', 'd2'] as const) if (boxes?.[k] == null) throw new Error(`cloud({a, b, c, d, d2}): box ${k} is missing`);
  if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 120 && Number.isFinite(opts.maxNodeW))) throw new Error(`cloud(): maxNodeW must be a number >= 120 (got ${opts.maxNodeW})`);
  for (const k of ['a', 'b', 'c', 'd', 'd2'] as const) {
    const t = typeof boxes[k] === 'string' ? undefined : (boxes[k] as {tone?: string}).tone;
    if (t !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(t)) throw new Error(`cloud(): box ${k} has tone ${String(t)}`);
  }
  const band: CloudBand = {type: 'cloud', a: boxes.a, b: boxes.b, c: boxes.c, d: boxes.d, d2: boxes.d2, ...(opts.assumptions === undefined ? {} : {assumptions: opts.assumptions.map(a => ({...a}))}), ...(opts.conflictLabel === undefined ? {} : {conflictLabel: opts.conflictLabel}), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), (['a', 'b', 'c', 'd', 'd2'] as const).map(k => { const v = boxes[k]; return typeof v === 'string' ? undefined : v.id; }));
}
/**
 * A mind map: the root in the middle, its children split to the right and the left (balanced by height, in the order
 * written: the right side first), each branch growing outward. Nodes are the same as tree()'s; `sides` pins a child of the root.
 *   mindmap({label: '新機能', children: [{label: '目的', children: [...]}, {label: '課題', id: 'issues'}]}, {sides: {issues: 'left'}})
 */
export function mindmap<const R extends TreeItem, const Id extends string = never>(root: R, opts?: MindmapOpts & {id?: Id}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
export function mindmap(root: TreeItem, opts: MindmapOpts = {}): TreeBand {
  if (opts.sides) for (const [id, side] of Object.entries(opts.sides)) if (side !== 'left' && side !== 'right') throw new Error(`mindmap(): sides.${id} must be 'left' or 'right' (got ${String(side)})`);
  const layouts = ['radial', 'right', 'left', 'down', 'up', 'org', 'list', 'brace', 'fishbone', 'timeline'];
  if (opts.layout !== undefined && !layouts.includes(opts.layout)) throw new Error(`mindmap(): layout must be ${layouts.join(' | ')} (got ${String(opts.layout)})`);
  if (opts.edges !== undefined && !['elbow', 'curve', 'straight'].includes(opts.edges)) throw new Error(`mindmap(): edges must be elbow | curve | straight (got ${String(opts.edges)})`);
  const band = tree(root, {...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)});
  Object.assign(band, {balanced: true, ...(opts.sides ? {sides: opts.sides} : {}), ...(opts.layout ? {layout: opts.layout} : {}), ...(opts.edges ? {edges: opts.edges} : {})});
  return band as never;
}
