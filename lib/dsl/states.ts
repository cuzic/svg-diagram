import {graphTones, litLink, resolveFocus} from '../focus.ts';
import {resolveIcon} from '../icon-registry.ts';
import {statesWords} from '../states-words.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import type {Focus} from '../types/core.ts';
import type {FlowEdge, FlowKind, FlowNode, FlowchartOpts, LadderEnd, LadderOpts, LadderStep, StateItem, StatesBand, StatesOpts, Transition} from '../types/diagrams.ts';
import {revealOf, scopeOpt, withAnchors, withHandle} from './shared.ts';

type StateIds<S extends readonly StateItem[]> = Extract<S[number]['id'], string>;
/**
 * A state diagram: states (boxes) and transitions (arrows) that place themselves in layers, flowing left to right
 * (dir: 'down' for top to bottom). A transition that goes back, skips a state or loops on itself is routed around the others.
 *   stateDiagram([{id: 'idle', label: '待機'}, {id: 'run', label: '実行中'}, {id: 'done', label: '完了', final: true}],
 *                [{from: 'idle', to: 'run', label: '開始'}, {from: 'run', to: 'idle', label: '中止'}, {from: 'run', to: 'done'}], {initial: 'idle'})
 */
export function stateDiagram<const S extends readonly StateItem[], const Id extends string = never>(states: S, transitions: readonly Transition[], opts?: StatesOpts & {id?: Id}): StatesBand & Declares<Id | StateIds<S>> & HandleOf<Id> & AnchorsOf<StateIds<S>>;
export function stateDiagram(states: readonly StateItem[], transitions: readonly Transition[], opts: StatesOpts = {}): StatesBand {
  return statesBandOf(states, transitions, opts);
}
/** focus on a state diagram / flowchart: the tones of the states (solid / accent / muted) and of the arrows (lit: accent, the rest muted). */
function focusGraph(states: readonly StateItem[], transitions: readonly Transition[], focus: Focus, who: string): {states: StateItem[]; transitions: Transition[]} {
  const ids = states.map(x => x.id), hit = resolveFocus(focus, ids, who);
  const tones = graphTones(states.length, transitions.map(t => [ids.indexOf(t.from), ids.indexOf(t.to)] as const), hit);
  return {
    states: states.map((x, i) => ({...x, tone: tones[i]})),
    transitions: transitions.map(t => ({...t, tone: litLink(ids.indexOf(t.from), ids.indexOf(t.to), hit) ? 'accent' as const : 'muted' as const})),
  };
}
/** The band of stateDiagram() and flowchart(): the same checks, with the words of the one that was called. */
function statesBandOf(states: readonly StateItem[], transitions: readonly Transition[], opts: StatesOpts, flavor?: 'flowchart', arrange?: 'ladder'): StatesBand {
  const w = statesWords(flavor, arrange);
  // a flowchart goes back to a decision as often as forward: its return arrows take the lane outside the figure (inline they run through other nodes)
  const returns = opts.returns ?? (flavor === 'flowchart' && !arrange ? 'outer' : undefined);
  if (!Array.isArray(states) || states.length === 0) throw new Error(flavor === 'flowchart' ? 'flowchart(nodes, edges) needs at least one node' : 'stateDiagram(states, transitions) needs at least one state');
  if (opts.dir !== undefined && opts.dir !== 'right' && opts.dir !== 'down' && opts.dir !== 'auto') throw new Error(`${w.who}: dir must be 'right', 'down' or 'auto' (got ${String(opts.dir)})`);
  if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW))) throw new Error(`${w.who}: maxNodeW must be a number >= 80 (got ${opts.maxNodeW})`);
  if (opts.straighten !== undefined && typeof opts.straighten !== 'boolean') throw new Error(`${w.who}: straighten must be true or false (got ${String(opts.straighten)})`);
  if (opts.returns !== undefined && opts.returns !== 'inline' && opts.returns !== 'outer') throw new Error(`${w.who}: returns must be 'inline' or 'outer' (got ${String(opts.returns)})`);
  for (const t of transitions) if (t.line !== undefined && !['solid', 'dashed', 'dotted'].includes(t.line)) throw new Error(`${w.who}: ${w.edge} ${t.from} -> ${t.to} has line ${String(t.line)}`);
  for (const s of states) if (s.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger'].includes(s.tone)) throw new Error(`${w.who}: ${w.node} "${s.id}" has tone ${String(s.tone)} (use plain, accent, new, changed, removed, muted, danger, solid or solid-danger)`);
  for (const s of states) if (s.shape !== undefined && !['box', 'circle', 'diamond', 'pill'].includes(s.shape)) throw new Error(`${w.who}: ${w.node} "${s.id}" has shape ${String(s.shape)} (use 'box', 'circle', 'diamond' or 'pill')`);
  for (const s of states) if ((s.shape === 'diamond' || s.shape === 'pill') && s.final) throw new Error(`${w.who}: ${w.node} "${s.id}" is a ${s.shape} and final: the double outline is a rectangle's (use a box)`);
  for (const t of transitions) { const s = states.find(x => x.id === t.from); if (t.from === t.to && (s?.shape === 'diamond' || s?.shape === 'pill')) throw new Error(`${w.who}: a ${s.shape} cannot loop to itself ("${t.from}": the loop leaves from the side of a rectangle)`); }
  for (const t of transitions) if (t.tone !== undefined && !['danger', 'accent', 'muted'].includes(t.tone)) throw new Error(`${w.who}: ${w.edge} ${t.from} -> ${t.to} has tone ${String(t.tone)} (use danger, accent or muted)`);
  if (opts.focus !== undefined) ({states, transitions} = focusGraph(states, transitions, opts.focus, w.who));
  const band: StatesBand = {type: 'states', ...(flavor ? {flavor} : {}), states: states.map(s => s.icon === undefined ? s : {...s, iconGlyph: resolveIcon(s.icon, w.who + ' ' + w.node + ' "' + s.id + '" icon')}), transitions: [...transitions], ...(opts.dir === undefined ? {} : {dir: opts.dir}), ...(opts.initial === undefined ? {} : {initial: opts.initial}), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(returns === undefined ? {} : {returns}), ...(flavor === 'flowchart' && opts.dir === undefined && !arrange ? {defaultDir: 'down' as const} : {}), ...(arrange ? {arrange} : {}), ...(opts.straighten === undefined ? {} : {straighten: opts.straighten}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, w.who), ...revealOf(opts)};
  if (opts.focus !== undefined && band.initial !== undefined) band.initialTone = resolveFocus(opts.focus, states.map(x => x.id), w.who).has(states.findIndex(x => x.id === band.initial)) ? 'accent' : 'muted';
  return withAnchors(withHandle(band, opts.id), states.map(s => s.id));
}
type FlowIds<N extends readonly FlowNode[]> = Extract<N[number]['id'], string>;
const FLOW_SHAPE = {process: undefined, decision: 'diamond', terminator: 'pill'} as const;
const FLOW_NODE_KEYS: readonly string[] = ['id', 'label', 'sub', 'kind', 'tone', 'icon'];
/**
 * A flowchart: steps, decisions (a diamond that holds the question) and start / end pills, joined by arrows; Yes / No go on the arrows that
 * leave a decision. It places itself like stateDiagram() and runs down unless `dir` says otherwise; a return to an earlier node goes round
 * the outside (`returns: 'outer'`). The question is wrapped inside the diamond, which grows with it.
 *   flowchart([{id: 's', kind: 'terminator', label: '相談'}, {id: 'q', kind: 'decision', label: '自分で答えられる？'}, {id: 'a', label: '回答する'}],
 *             [{from: 's', to: 'q'}, {from: 'q', to: 'a', label: 'Yes'}])
 */
export function flowchart<const N extends readonly FlowNode[], const Id extends string = never>(nodes: N, edges: readonly FlowEdge[], opts?: FlowchartOpts & {id?: Id}): StatesBand & Declares<Id | FlowIds<N>> & HandleOf<Id> & AnchorsOf<FlowIds<N>>;
export function flowchart(nodes: readonly FlowNode[], edges: readonly FlowEdge[], opts: FlowchartOpts = {}): StatesBand {
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('flowchart(nodes, edges) needs at least one node');
  if ('initial' in opts) throw new Error("flowchart(): has no `initial`: start with a node of kind 'terminator'");
  const items: StateItem[] = nodes.map(n => {
    const extra = Object.keys(n).filter(k => !FLOW_NODE_KEYS.includes(k));
    if (extra.length) throw new Error(`flowchart(): node "${n.id}" has an unknown option ${extra.map(k => `'${k}'`).join(', ')} (id, label, sub, kind, tone, icon)`);
    if (n.kind !== undefined && !(n.kind in FLOW_SHAPE)) throw new Error(`flowchart(): node "${n.id}" has kind ${String(n.kind)} (use 'process', 'decision' or 'terminator')`);
    const {kind: _kind, ...rest} = n, kind: FlowKind = n.kind ?? 'process', shape = FLOW_SHAPE[kind];
    return {...rest, ...(shape === undefined ? {} : {shape})};
  });
  return statesBandOf(items, edges, opts, 'flowchart');
}

type LadderIds<N extends number> = `q${N}` | `a${N}` | 'otherwise';
const LADDER_STEP_KEYS = ['q', 'yes', 'sub', 'tone', 'yesLabel', 'noLabel'], LADDER_END_KEYS = ['label', 'sub', 'tone'], LADDER_OPT_KEYS = ['yes', 'no', 'question', 'maxNodeW', 'id', 'scope', 'reveal', 'until'];
/**
 * A decision ladder (ADR 0083): yes/no questions stacked down the left; each "yes" goes right to its answer, each "no" goes straight down to the next question,
 * and the last "no" ends in the final box. It is placed as two fixed columns (no layers, no staircase), so five questions fit a 16:9 slide in readable text.
 * The ids are q1..qN (questions), a1..aN (answers) and `otherwise` (the final box). `yes` / `no` change the words on the arrows (a step's own `yesLabel` / `noLabel` win).
 *   decisionLadder([{q: '貸出票は書いてある？', yes: '窓口で受け付ける'}, {q: '館内で読むだけ？', yes: '閲覧席へ案内する', sub: '2 時間まで'}], '後日の来館をお願いする')
 */
export function decisionLadder<const Id extends string = never>(steps: readonly LadderStep[], otherwise: LadderEnd, opts?: LadderOpts & {id?: Id}): StatesBand & Declares<Id | LadderIds<number>> & HandleOf<Id> & AnchorsOf<LadderIds<number>>;
export function decisionLadder(steps: readonly LadderStep[], otherwise: LadderEnd, opts: LadderOpts = {}): StatesBand {
  const bad = (m: string): never => { throw new Error(`decisionLadder(): ${m}`); };
  // `blank`: '' is allowed (the words on the arrows, a second line)
  const text = (v: unknown, of: string, blank = false): string => typeof v === 'string' && (blank || v.trim()) ? v : bad(`${of} must be ${blank ? "text ('' for none)" : 'text'} (got ${String(v)})`);
  const only = (o: unknown, ok: string[], of: string, hint = ''): void => {
    if (typeof o !== 'object' || o === null || Array.isArray(o)) bad(`${of} must be an object {${ok.join(', ')}} (got ${String(o)})`);
    const x = Object.keys(o as object).filter(k => !ok.includes(k));
    if (x.length) bad(`${of} has no option ${x.map(k => `'${k}'`).join(', ')} (${ok.join(', ')})${hint}`);
  };
  if (!Array.isArray(steps) || !steps.length) bad('needs at least one step');
  const end = typeof otherwise === 'string' ? {label: otherwise} : otherwise;
  only(end, LADDER_END_KEYS, '`otherwise`');
  text(end.label, '`otherwise`'); if (end.sub !== undefined) text(end.sub, '`otherwise` sub', true);
  only(opts, LADDER_OPT_KEYS, 'the options', ': the ladder is always two columns, the questions down the left, so dir / focus / returns do not apply');
  if (opts.question !== undefined && opts.question !== 'box' && opts.question !== 'diamond') bad(`question must be 'box' or 'diamond' (got ${String(opts.question)})`);
  const words = [opts.yes ?? 'はい', opts.no ?? 'いいえ'].map((v, k) => text(v, ['yes', 'no'][k] as string, true));
  const items: StateItem[] = [], edges: Transition[] = [];
  const arrow = (from: string, to: string, label: string): Transition => ({from, to, ...(label ? {label} : {})});
  steps.forEach((st, i) => {
    const at = `step ${i + 1}`, id = (p: string) => `${p}${i + 1}`;
    only(st, LADDER_STEP_KEYS, `${at} (each step is {q, yes, ...}: the question and the answer its yes leads to)`);
    text(st.q, `${at} q`); text(st.yes, `${at} yes`);
    for (const k of ['sub', 'yesLabel', 'noLabel'] as const) if (st[k] !== undefined) text(st[k], `${at} ${k}`, true);
    items.push({id: id('q'), label: st.q, ...(opts.question === 'diamond' ? {shape: 'diamond' as const} : {})}, {id: id('a'), label: st.yes, ...(st.sub ? {sub: st.sub} : {}), ...(st.tone ? {tone: st.tone} : {})});
    edges.push(arrow(id('q'), id('a'), st.yesLabel ?? words[0] as string), arrow(id('q'), i + 1 < steps.length ? `q${i + 2}` : 'otherwise', st.noLabel ?? words[1] as string));
  });
  items.push({id: 'otherwise', label: end.label, ...(end.sub ? {sub: end.sub} : {}), ...(end.tone ? {tone: end.tone} : {})});
  const {question: _question, yes: _yes, no: _no, ...rest} = opts;
  return statesBandOf(items, edges, rest, 'flowchart', 'ladder');
}
