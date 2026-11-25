import type { BandDef, WithBandDef } from '../band-def.ts';
import { bpmn as build } from '../dsl/bpmn.ts';
import type { BpmnBand, BpmnOpts, LaidOutBpmn, BpmnLane, BpmnNode, BpmnFlow } from '../types/diagrams.ts';
export declare function bpmn<const N extends readonly BpmnNode[], const Id extends string = never>(lanes: readonly BpmnLane[], nodes: N, flows: readonly BpmnFlow[], opts?: BpmnOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<N, Id>>, LaidOutBpmn>;
/** @internal Definition used by the full renderer. */
export declare const bpmnDefinition: BandDef<BpmnBand, LaidOutBpmn>;
