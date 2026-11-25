import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { BpmnBand, BpmnOpts, BpmnLane, BpmnNode, BpmnFlow } from '../types/diagrams.ts';
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
export {};
