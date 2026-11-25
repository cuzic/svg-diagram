import {graphTones, resolveFocus} from '../focus.ts';
import {resolveIcon} from '../icon-registry.ts';
import {must} from '../must.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import type {BpmnBand, BpmnOpts, BpmnLane, BpmnNode, BpmnFlow} from '../types/diagrams.ts';
import {assertBoxTone, revealOf, scopeOpt, TREE_TONES, withAnchors, withHandle} from './shared.ts';

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
  for (const n of nodes) if (n.tone !== undefined && !TREE_TONES.includes(n.tone)) throw new Error(`bpmn(): node "${n.id}" has tone ${String(n.tone)} (use ${TREE_TONES.join(', ')})`);
  // an icon is resolved here (the shell) and carried on the node, so layout and emit stay free of I/O
  const placedNodes = nodes.map(n => n.icon === undefined ? n : {...n, iconGlyph: resolveIcon(n.icon, `bpmn() task "${n.id}" icon`)});
  for (const f of flows) if (f.line !== undefined && f.line !== 'solid' && f.line !== 'dashed') throw new Error(`bpmn(): flow ${f.from} -> ${f.to} has line ${String(f.line)}`);
  if (opts.fit !== undefined && opts.fit !== 'shrink') throw new Error(`bpmn(): fit must be 'shrink' (got ${String(opts.fit)})`);
  if (opts.dir !== undefined && opts.dir !== 'h' && opts.dir !== 'v') throw new Error(`bpmn(): dir must be 'h' or 'v' (got ${String(opts.dir)})`);
  if (opts.dir === 'v' && opts.fit !== undefined) throw new Error("bpmn(): fit: 'shrink' is for the horizontal figure; a vertical one (dir: 'v') takes its column width from the lanes");
  const focused = opts.focus === undefined ? undefined : resolveFocus(opts.focus, nodes.map(n => n.id), 'bpmn()');
  const toned = focused === undefined ? placedNodes : (() => {
    const ids = nodes.map(n => n.id), tones = graphTones(ids.length, flows.map(f => [ids.indexOf(f.from), ids.indexOf(f.to)] as const), focused);
    return placedNodes.map((n, i) => ({...n, tone: must(tones[i])}));
  })();
  const band: BpmnBand = {type: 'bpmn', lanes: [...lanes], nodes: toned, flows: [...flows], ...(focused === undefined ? {} : {focused: [...focused].map(i => must(nodes[i]).id)}), ...(opts.id === undefined ? {} : {id: opts.id}), ...(opts.fit === undefined ? {} : {fit: opts.fit}), ...(opts.dir === 'v' ? {dir: 'v' as const} : {}), ...scopeOpt(opts, 'bpmn()'), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), nodes.map(n => n.id));
}
