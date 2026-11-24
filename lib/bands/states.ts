import {textsAndLabels} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {flowchart as buildFlowchart, stateDiagram as buildStateDiagram} from '../dsl/states.ts';
import {renderStates} from '../emit-figures.ts';
import {snapGrid} from '../layout-util.ts';
import {scopeOf} from '../scope-name.ts';
import {layoutStatesBand, statesTexts} from '../states.ts';
import type {FlowEdge, FlowNode, FlowchartOpts, LaidOutStates, StateItem, StatesBand, StatesOpts, Transition} from '../types/diagrams.ts';
import {statesProblems} from '../verify-base.ts';
import {anchorRects} from '../verify-rects.ts';

const definition = {
  type: 'states',
  textSizes: textsAndLabels,
  ids: data => data.states.map(item => item.id),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of statesTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap, canvas}) {
    const scope = scopeOf(data);
    const placed = layoutStatesBand(data, x, snapGrid(y), w, widthOf, roles, {wrap, keepWords: false}, canvas?.height);
    const laid = scope ? {...placed, scope} : placed;
    return {laid, h: laid.h, anchors: laid.anchors};
  },
  emit: (laid, {theme, tones}) => renderStates(laid, theme, tones),
  verify: {
    rects: laid => anchorRects(laid),
    check: laid => statesProblems(laid).map(message => ({rule: 'states', severity: 'problem', message})),
  },
} satisfies BandDef<StatesBand, LaidOutStates>;

export function stateDiagram<const S extends readonly StateItem[], const Id extends string = never>(
  states: S, transitions: readonly Transition[], opts?: StatesOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildStateDiagram<S, Id>>, LaidOutStates> {
  const data = buildStateDiagram<S, Id>(states, transitions, opts);
  return band<typeof data, LaidOutStates>(definition, data);
}

export function flowchart<const N extends readonly FlowNode[], const Id extends string = never>(
  nodes: N, edges: readonly FlowEdge[], opts?: FlowchartOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildFlowchart<N, Id>>, LaidOutStates> {
  const data = buildFlowchart<N, Id>(nodes, edges, opts);
  return band<typeof data, LaidOutStates>(definition, data);
}
