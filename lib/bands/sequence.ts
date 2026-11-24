import {describeSequence} from '../diagram-description.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {sequence as build} from '../dsl/sequence.ts';
import {renderSequence} from '../emit-sequence.ts';
import {snapGrid} from '../layout-util.ts';
import {layoutSequence, sequenceTexts} from '../layout-sequence.ts';
import type {ActorIn, SeqStepIn} from '../strict.ts';
import type {LaidOutSequence, SequenceBand, SequenceOpts} from '../types/sequence-table-swimlane.ts';

const definition = {
  type: 'sequence',
  describe: data => ['structure', describeSequence(data)],
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of sequenceTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const laid = layoutSequence(data, x, snapGrid(y), w, widthOf, roles, wrap);
    return {laid, h: laid.h};
  },
  emit: (laid, {theme, tones, roles}) => renderSequence(laid, theme, tones, roles),
  svgDefs: laid => ({arrow: laid.steps.some(step => step.kind === 'self' || step.kind === 'msg' && step.arrow !== 'none')}),
} satisfies BandDef<SequenceBand, LaidOutSequence>;

export function sequence<const A extends string, const Id extends string = never>(actors: ActorIn<A>[], steps: SeqStepIn<NoInfer<A>>[], opts?: SequenceOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<A, Id>>, LaidOutSequence> {
  const data = build<A, Id>(actors, steps, opts);
  return band<typeof data, LaidOutSequence>(definition, data);
}
