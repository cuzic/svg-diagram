import {layoutBoxLike} from '../layout-box-like.ts';
import {ownRunSizes, textsAndLabels} from '../band-text-sizes.ts';
import {whole} from '../inventory-core.ts';
import {describeSwimlaneFigure} from '../diagram-description.ts';
import {narrowTextFindings} from '../verify-shrink.ts';
import {band} from '../band-def.ts';
import type {BandDef, DiagramFindings} from '../band-def.ts';
import type {Finding} from '../types/verdicts.ts';
import {withAnchors} from '../dsl/shared.ts';
import {swimlane as build} from '../dsl/swimlane.ts';
import {renderSwimlane} from '../emit-swimlane.ts';
import {layoutSwimlane} from '../layout-swimlane.ts';
import {swimlaneFindings} from '../swimlane-rules.ts';
import {checked} from '../reveal-visibility.ts';
import type {AnchorsOf, FlowCheck, FlowIn, LaneCheck, StepCheck, StepIds, SwimlaneStepIn} from '../strict.ts';
import type {ConnectBand, LaidOutConnect} from '../types/containers.ts';
import type {LaidOutSwimlane, SwimlaneAutoBand, SwimlaneBand, SwimlaneLane, SwimlaneOpts} from '../types/sequence-table-swimlane.ts';
import {boxDefinition, boxDiagramFindings} from './box.ts';
import {layoutSwimlaneAuto, swimlaneAutoTexts} from '../layout-swimlane-auto.ts';
import {layoutSwimlaneAutoVertical} from '../layout-swimlane-auto-vertical.ts';
import {renderSwimlaneAuto} from '../emit-swimlane-auto.ts';
import {swimlaneAutoProblems} from '../verify-swimlane-auto.ts';
import {edgeBendFindings} from '../verify-edge-bends.ts';
import {nameBpmnNodes} from '../emit-node-ids.ts';
import {anchorRects} from '../verify-rects.ts';
import {at} from '../finding-rules.ts';
import {appendPlacedBand} from '../layout-placed.ts';
import type {LayoutCtx} from '../layout-ctx.ts';
import {must} from '../must.ts';
import type {BpmnBand, LaidOutBpmn} from '../types/diagrams.ts';

/** one-story: more than one swimlane in a diagram. A figure built through the deprecated `bpmn()` alias is still one bpmn figure, so it does not count. */
const oneStoryFindings: DiagramFindings = (diagram): Finding[] => {
  const count = diagram.bands.filter(b => b.type === 'swimlane' && !(b.arrange === 'auto' && b.via === 'bpmn')).length;
  return count > 1 ? [{rule: 'one-story', severity: 'warn', message: `スイムレーンが ${count} つある。1 図 1 話にして、図を分けることを検討する`}] : [];
};

const CANNOT_DRAW_BPMN_DATA = '帯「bpmn」のデータは描けなくなりました。`bpmn()` か `swimlane({cols: \'auto\'})` で作り直してください（ADR 0086）';
/** The placed hooks of a `cols: 'auto'` figure (its laid-out shape keeps `type: 'bpmn'`), shared by outputDefinitions and FULL_DEFINITIONS. Raw `{type: 'bpmn'}` data no longer draws and says how to rebuild it. */
const autoDefinition = {
  type: 'bpmn',
  selfDimming: true,
  textSizes: textsAndLabels,
  ids: (data: BpmnBand) => data.nodes.map(item => item.id),
  measure(): void {
    throw new Error(CANNOT_DRAW_BPMN_DATA);
  },
  layout(): never {
    throw new Error(CANNOT_DRAW_BPMN_DATA);
  },
  emit: (laid, {theme, tones}) => renderSwimlaneAuto(laid, theme, tones),
  locations: {drawsFrame: (laid, item) => item !== undefined && must(laid.nodes[item]).kind === 'task'},
  nameNodes: nameBpmnNodes,
  verify: {
    diagramFindings: edgeBendFindings,
    rects: laid => anchorRects(laid),
    layoutFindings: narrowTextFindings,
    check: laid => swimlaneAutoProblems(laid).map(message => ({rule: 'bpmn', severity: 'problem', message})),
  },
} satisfies BandDef<BpmnBand, LaidOutBpmn>;

/** A `cols: 'auto'` figure: the auto engine lays it out, and the placed figure (`type: 'bpmn'`) is appended like a band the public layout shape placed. The duplicate-anchor message is the authored one: the branch cannot see core's `authored`. */
function layoutSwimlaneAutoBand(band: SwimlaneAutoBand, ctx: LayoutCtx, x: number, w: number): void {
  const placed = (band.dir === 'v' ? layoutSwimlaneAutoVertical : layoutSwimlaneAuto)(
    band, x, ctx.originOf(band, ctx.y), w, ctx.widthOf, ctx.roles, {wrap: ctx.wrap, keepWords: ctx.keepWords, space: ctx.space});
  appendPlacedBand(band, placed, ctx, 'each band needs a unique id', 'a figure item takes an id that another anchor already has');
}

const definition = {
  type: 'swimlane',
  // the laid.type === 'bpmn' branches below (textSizes, emit, rects) never run: a placed auto figure resolves
  // through outputDefinitions.bpmn (and FULL_DEFINITIONS.bpmn in the full renderer). They exist only so this
  // definition can be typed BandDef<SwimlaneBand, LaidOutSwimlane | LaidOutBpmn>.
  textSizes: (laid: LaidOutSwimlane | LaidOutBpmn) => laid.type === 'bpmn' ? textsAndLabels(laid) : ownRunSizes(laid),
  // an auto figure's node ids, for graph-disconnected attribution (connect.ts); explicit columns keep the old behavior (no ids)
  ids: (data: SwimlaneBand) => data.arrange === 'auto' ? data.nodes.map(item => item.id) : [],
  inventory: whole,
  describe: (data, stage) => {
    const text = describeSwimlaneFigure(data, stage);
    return text === undefined ? undefined : ['structure', text];
  },
  internal: true,
  layoutBoxLike,
  layout: (band: SwimlaneBand, ctx: LayoutCtx, x: number, w: number) => {
    if (band.arrange === 'auto') layoutSwimlaneAutoBand(band, ctx, x, w);
    else layoutSwimlane(band, ctx, x, w);
  },
  outputDefinitions: {box: boxDefinition, bpmn: autoDefinition},
  measure(data, env) {
    if (data.arrange === 'auto') {
      for (const [text, size, weight, font] of swimlaneAutoTexts(data, env.roles)) env.atoms(text, size, weight, font);
      return;
    }
    const {atoms, roles} = env;
    for (const lane of data.lanes) atoms(lane.label, roles.title, 700);
    for (const phase of data.phases ?? []) atoms(phase.label, roles.note, 700);
    for (const boundary of data.boundaries ?? []) if (boundary.label) atoms(boundary.label, roles.note, 700);
    for (const step of data.steps) boxDefinition.measure?.(step, env);
  },
  revealElements(data, start, end) {
    // an auto figure's nodes carry no reveal timing of their own (the DSL refuses it); they register their ids like a bpmn figure's
    if (data.arrange === 'auto') return {last: start, warnings: [], items: data.nodes};
    let last = start;
    for (const [index, step] of data.steps.entries()) {
      const label = `swimlane() step ${index + 1}`;
      const reveal = Math.max(start, checked(step.reveal, label) ?? 0);
      const until = Math.min(end ?? Infinity, checked(step.until, `${label} (until)`) ?? Infinity);
      if (until <= reveal) throw new Error(`${label}: until ${until} must be later than its reveal ${reveal}`);
      if (reveal) step.reveal = reveal;
      if (Number.isFinite(until)) step.until = until;
      last = Math.max(last, step.until ?? reveal);
    }
    return {last, warnings: [], items: data.steps};
  },
  emit: (laid: LaidOutSwimlane | LaidOutBpmn, env) => laid.type === 'bpmn'
    ? renderSwimlaneAuto(laid, env.theme, env.tones)
    : renderSwimlane(laid, env.theme, env.roles),
  verify: {
    diagramFindings: [...boxDiagramFindings, oneStoryFindings, edgeBendFindings],
    findings: (data, {connects}) => {
      // an auto figure keeps the bpmn check behavior: no swimlane findings, and the alias warns that it is deprecated
      if (data.arrange === 'auto') {
        return data.via === 'bpmn'
          ? [{...at(data), rule: 'bpmn-deprecated', severity: 'warn', message: '`bpmn()` は非推奨です。`swimlane()` に `kind` と `cols: \'auto\'` を書いてください（ADR 0086）'}]
          : [];
      }
      return swimlaneFindings(data, connects);
    },
    layoutFindings: narrowTextFindings,
    rects: (laid: LaidOutSwimlane | LaidOutBpmn) => laid.type === 'bpmn' ? anchorRects(laid) : [],
  },
} satisfies BandDef<SwimlaneBand, LaidOutSwimlane | LaidOutBpmn>;

export function swimlane<
  const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never, const O extends object = object,
>(
  lanes: L & LaneCheck<L, O>, steps: S & StepCheck<L, S>,
  opts?: O & Omit<SwimlaneOpts, 'flows' | 'id'> & {id?: Id; flows?: F & FlowCheck<StepIds<S>, F>},
  connectors?: BandDef<ConnectBand, LaidOutConnect>,
) {
  const bands = build<L, S, F, Id, O>(lanes, steps, opts).map(data => {
    if (data.type === 'swimlane') {
      return data.arrange === 'auto'
        ? band<typeof data, LaidOutBpmn>(definition, data)
        : band<typeof data, LaidOutSwimlane>(definition, data);
    }
    if (!connectors?.internal || !connectors.resolveConnect) throw new Error('bands/swimlane: flows を使う場合は bands/connect の connectDefinition を第4引数に渡してください');
    return band<ConnectBand, LaidOutConnect>(connectors, data);
  });
  return withAnchors(bands, [opts?.id, ...steps.map(step => step.id)]) as typeof bands & AnchorsOf<StepIds<S> | Id>;
}

/** @internal Definition used by the full renderer. */
export const swimlaneDefinition: BandDef<SwimlaneBand, LaidOutSwimlane | LaidOutBpmn> = definition;

/** @internal The placed hooks of a `cols: 'auto'` figure, for FULL_DEFINITIONS. */
export const swimlaneAutoDefinition: BandDef<BpmnBand, LaidOutBpmn> = autoDefinition;
