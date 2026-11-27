import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {bpmn as build} from '../dsl/bpmn.ts';
import type {BpmnOpts, BpmnLane, BpmnNode, BpmnFlow, LaidOutBpmn} from '../types/diagrams.ts';
import {swimlaneDefinition} from './swimlane.ts';

/**
 * A business process in lanes, BPMN-style (see `bpmn()` in lib/dsl/bpmn.ts): a thin alias that builds a
 * `cols: 'auto'` swimlane figure, laid out by the swimlane definition.
 * @deprecated Write `swimlane()` with `kind` and `cols: 'auto'` instead (ADR 0086).
 */
export function bpmn<const N extends readonly BpmnNode[], const Id extends string = never>(
  lanes: readonly BpmnLane[], nodes: N, flows: readonly BpmnFlow[], opts?: BpmnOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<N, Id>>, LaidOutBpmn> {
  const data = build<N, Id>(lanes, nodes, flows, opts);
  // the definition lays out both swimlane shapes; an alias band (`arrange: 'auto'`) is always placed as a LaidOutBpmn
  return band<typeof data, LaidOutBpmn>(swimlaneDefinition as BandDef<typeof data, LaidOutBpmn>, data);
}
