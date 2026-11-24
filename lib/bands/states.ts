import {layoutFitRules, layoutFitVerification, layoutFitFindings} from '../verify-layout-fit.ts';
import {edgeBendFindings} from '../verify-edge-bends.ts';
import {densityRestorationFindings} from '../verify-density.ts';
import {flowchartFindings} from '../verify-flowchart.ts';
import {textsAndLabels} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {flowchart as buildFlowchart, stateDiagram as buildStateDiagram} from '../dsl/states.ts';
import {renderStates} from '../emit-states.ts';
import {snapGrid} from '../layout-util.ts';
import {scopeOf} from '../scope-name.ts';
import {layoutStatesBand, statesTexts} from '../states.ts';
import type {FlowEdge, FlowNode, FlowchartOpts, LaidOutStates, StateItem, StatesBand, StatesOpts, Transition} from '../types/diagrams.ts';
import {statesProblems} from '../verify-base.ts';
import {anchorRects} from '../verify-rects.ts';

export const statesDefinition: BandDef<StatesBand, LaidOutStates> = {
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
  rules: layoutFitRules,
  verify: {
    ...layoutFitVerification,
    diagramFindings: [densityRestorationFindings, edgeBendFindings],
    rects: laid => anchorRects(laid),
    layoutFindings: laid => [...layoutFitFindings(laid), ...flowchartFindings(laid)],
    check: laid => statesProblems(laid).map(message => ({rule: 'states', severity: 'problem', message})),
  },
};

export function stateDiagram<const S extends readonly StateItem[], const Id extends string = never>(
  states: S, transitions: readonly Transition[], opts?: StatesOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildStateDiagram<S, Id>>, LaidOutStates> {
  const data = buildStateDiagram<S, Id>(states, transitions, opts);
  return band<typeof data, LaidOutStates>(statesDefinition, data);
}

export function flowchart<const N extends readonly FlowNode[], const Id extends string = never>(
  nodes: N, edges: readonly FlowEdge[], opts?: FlowchartOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildFlowchart<N, Id>>, LaidOutStates> {
  const data = buildFlowchart<N, Id>(nodes, edges, opts);
  return band<typeof data, LaidOutStates>(statesDefinition, data);
}
