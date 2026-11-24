import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {box as buildBox} from '../dsl/box.ts';
import {renderBox} from '../emit-boxes.ts';
import {layoutBoxLikeBand} from '../layout-box-like.ts';
import {styledAtoms, textRuns} from '../layout-text.ts';
import type {BoxInput} from '../strict.ts';
import {TAG_SIZE} from '../tokens.ts';
import type {BoxBand, LaidOutBox} from '../types/text-bands.ts';
import {boxLikeContrastProblems, nowrapProblems} from '../verify-box-like.ts';

const definition = {
  type: 'box',
  measure(data, {atoms, roles}) {
    if (data.tag) atoms(data.tag, roles.tag ?? TAG_SIZE, 700);
    if (data.stamp) atoms(data.stamp, roles.note, 400);
    for (const run of textRuns(data, roles)) {
      const font = run.mono ? 'mono' : 'sans';
      for (let size = run.fit && run.nowrap ? run.fit.min : run.size; size <= run.size; size++) {
        for (const {text, weight} of styledAtoms(run)) atoms(text, size, weight, font);
      }
    }
  },
  internal: true,
  layout: layoutBoxLikeBand,
  emit(laid, {theme, tones, roles}) {
    return renderBox(laid, theme, tones, roles);
  },
  verify: {
    check(laid, {theme, tones}) {
      return [
        ...nowrapProblems(laid).map(message => ({rule: 'nowrap', severity: 'problem' as const, message})),
        ...boxLikeContrastProblems(laid, laid.tone ?? 'plain', theme, tones).map(message => ({rule: 'contrast', severity: 'problem' as const, message})),
      ];
    },
  },
} satisfies BandDef<BoxBand, LaidOutBox>;

export function box<const Id extends string = never>(opts: BoxInput<Id>): WithBandDef<ReturnType<typeof buildBox<Id>>, LaidOutBox> {
  const data = buildBox<Id>(opts);
  return band<typeof data, LaidOutBox>(definition, data);
}

export {icon} from '../icon-registry.ts';
export {em} from '../rich.ts';
