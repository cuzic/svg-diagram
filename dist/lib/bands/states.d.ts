import type { BandDef, WithBandDef } from '../band-def.ts';
import { flowchart as buildFlowchart, stateDiagram as buildStateDiagram } from '../dsl/states.ts';
import type { FlowEdge, FlowNode, FlowchartOpts, LaidOutStates, StateItem, StatesBand, StatesOpts, Transition } from '../types/diagrams.ts';
export declare const statesDefinition: BandDef<StatesBand, LaidOutStates>;
export declare function stateDiagram<const S extends readonly StateItem[], const Id extends string = never>(states: S, transitions: readonly Transition[], opts?: StatesOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildStateDiagram<S, Id>>, LaidOutStates>;
export declare function flowchart<const N extends readonly FlowNode[], const Id extends string = never>(nodes: N, edges: readonly FlowEdge[], opts?: FlowchartOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildFlowchart<N, Id>>, LaidOutStates>;
