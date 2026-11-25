import {layoutBoxLike} from '../layout-box-like.ts';
import {ownRunSizes} from '../band-text-sizes.ts';
import {whole} from '../inventory-core.ts';
import {describeSwimlane} from '../diagram-description.ts';
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
import type {LaidOutSwimlane, SwimlaneBand, SwimlaneLane, SwimlaneOpts} from '../types/sequence-table-swimlane.ts';
import {boxDefinition, boxDiagramFindings} from './box.ts';

/** one-story: more than one swimlane in a diagram. */
const oneStoryFindings: DiagramFindings = (diagram): Finding[] => {
  const count = diagram.bands.filter(b => b.type === 'swimlane').length;
  return count > 1 ? [{rule: 'one-story', severity: 'warn', message: `スイムレーンが ${count} つある。1 図 1 話にして、図を分けることを検討する`}] : [];
};

const definition = {
  type: 'swimlane',
  textSizes: ownRunSizes,
  inventory: whole,
  describe: (data, stage) => ['structure', describeSwimlane(data, stage)],
  internal: true,
  layoutBoxLike,
  layout: layoutSwimlane,
  outputDefinitions: {box: boxDefinition},
  measure(data, env) {
    const {atoms, roles} = env;
    for (const lane of data.lanes) atoms(lane.label, roles.title, 700);
    for (const phase of data.phases ?? []) atoms(phase.label, roles.note, 700);
    for (const boundary of data.boundaries ?? []) if (boundary.label) atoms(boundary.label, roles.note, 700);
    for (const step of data.steps) boxDefinition.measure?.(step, env);
  },
  revealElements(data, start, end) {
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
  emit: (laid, env) => renderSwimlane(laid, env.theme, env.roles),
  verify: {
    diagramFindings: [...boxDiagramFindings, oneStoryFindings],
    findings: (data, {connects}) => swimlaneFindings(data, connects),
    layoutFindings: narrowTextFindings,
    rects: () => [],
  },
} satisfies BandDef<SwimlaneBand, LaidOutSwimlane>;

export function swimlane<
  const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never,
>(
  lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>,
  opts?: Omit<SwimlaneOpts, 'flows' | 'id'> & {id?: Id; flows?: F & FlowCheck<StepIds<S>, F>},
  connectors?: BandDef<ConnectBand, LaidOutConnect>,
) {
  const bands = build<L, S, F, Id>(lanes, steps, opts).map(data => {
    if (data.type === 'swimlane') return band<typeof data, LaidOutSwimlane>(definition, data);
    if (!connectors?.internal || !connectors.resolveConnect) throw new Error('bands/swimlane: flows を使う場合は bands/connect の connectDefinition を第4引数に渡してください');
    return band<ConnectBand, LaidOutConnect>(connectors, data);
  });
  return withAnchors(bands, [opts?.id, ...steps.map(step => step.id)]) as typeof bands & AnchorsOf<StepIds<S> | Id>;
}

/** @internal Definition used by the full renderer. */
export const swimlaneDefinition: BandDef<SwimlaneBand, LaidOutSwimlane> = definition;
