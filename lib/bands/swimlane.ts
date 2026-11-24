import {narrowTextFindings} from '../verify-shrink.ts';
import {band} from '../band-def.ts';
import type {BandDef} from '../band-def.ts';
import {withAnchors} from '../dsl/shared.ts';
import {swimlane as build} from '../dsl/sequence-table-swimlane.ts';
import {renderSwimlane} from '../emit-boxes.ts';
import {layoutSwimlane} from '../layout-swimlane.ts';
import {swimlaneFindings} from '../swimlane-rules.ts';
import {checked} from '../reveal-visibility.ts';
import type {AnchorsOf, FlowCheck, FlowIn, LaneCheck, StepCheck, StepIds, SwimlaneStepIn} from '../strict.ts';
import type {ConnectBand, LaidOutConnect} from '../types/containers.ts';
import type {LaidOutSwimlane, SwimlaneBand, SwimlaneLane, SwimlaneOpts} from '../types/sequence-table-swimlane.ts';
import type {LaidOutBox} from '../types/text-bands.ts';
import {ownRect} from '../verify-rects.ts';
import {boxDefinition} from './box.ts';

const definition = {
  type: 'swimlane',
  internal: true,
  layout: layoutSwimlane,
  outputTypes: ['box'],
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
  emit: (laid, env) => laid.type === 'box'
    ? boxDefinition.emit(laid, env)
    : renderSwimlane(laid, env.theme, env.roles),
  verify: {
    diagramFindings: boxDefinition.verify?.diagramFindings,
    findings: (data, {connects}) => swimlaneFindings(data, connects),
    layoutFindings: laid => laid.type === 'swimlane' ? narrowTextFindings(laid) : [],
    rects: laid => laid.type === 'box' ? ownRect(laid) : [],
    check: (laid, env) => laid.type === 'box' ? boxDefinition.verify?.check?.(laid, env) ?? [] : [],
  },
} satisfies BandDef<SwimlaneBand, LaidOutSwimlane | LaidOutBox>;

export function swimlane<
  const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never,
>(
  lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>,
  opts?: Omit<SwimlaneOpts, 'flows' | 'id'> & {id?: Id; flows?: F & FlowCheck<StepIds<S>, F>},
  connectors?: BandDef<ConnectBand, LaidOutConnect>,
) {
  const bands = build<L, S, F, Id>(lanes, steps, opts).map(data => {
    if (data.type === 'swimlane') return band<typeof data, LaidOutSwimlane | LaidOutBox>(definition, data);
    if (!connectors?.internal || !connectors.resolveConnect) throw new Error('bands/swimlane: flows を使う場合は bands/connect の connectDefinition を第4引数に渡してください');
    return band<ConnectBand, LaidOutConnect>(connectors, data);
  });
  return withAnchors(bands, [opts?.id, ...steps.map(step => step.id)]) as typeof bands & AnchorsOf<StepIds<S> | Id>;
}
