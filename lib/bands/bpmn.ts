import {textsAndLabels} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {bpmnTexts, layoutBpmn} from '../bpmn.ts';
import {layoutBpmnVertical} from '../bpmn-vertical.ts';
import {bpmn as build} from '../dsl/bpmn.ts';
import {renderBpmn} from '../emit-figures.ts';
import {snapGrid} from '../layout-util.ts';
import {scopeOf} from '../scope-name.ts';
import type {BpmnBand, BpmnOpts, LaidOutBpmn, BpmnLane, BpmnNode, BpmnFlow} from '../types/diagrams.ts';
import {bpmnProblems} from '../verify-bpmn.ts';
import {anchorRects} from '../verify-rects.ts';

const definition = {
  type: 'bpmn',
  textSizes: textsAndLabels,
  ids: data => data.nodes.map(item => item.id),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of bpmnTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const scope = scopeOf(data);
    const placed = (data.dir === 'v' ? layoutBpmnVertical : layoutBpmn)(data, x, snapGrid(y), w, widthOf, roles, {wrap, keepWords: false});
    const laid = scope ? {...placed, scope} : placed;
    return {laid, h: laid.h, anchors: laid.anchors};
  },
  emit: (laid, {theme, tones}) => renderBpmn(laid, theme, tones),
  verify: {
    rects: laid => anchorRects(laid),
    check: laid => bpmnProblems(laid).map(message => ({rule: 'bpmn', severity: 'problem', message})),
  },
} satisfies BandDef<BpmnBand, LaidOutBpmn>;

export function bpmn<const N extends readonly BpmnNode[], const Id extends string = never>(
  lanes: readonly BpmnLane[], nodes: N, flows: readonly BpmnFlow[], opts?: BpmnOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<N, Id>>, LaidOutBpmn> {
  const data = build<N, Id>(lanes, nodes, flows, opts);
  return band<typeof data, LaidOutBpmn>(definition, data);
}
