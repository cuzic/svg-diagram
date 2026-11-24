import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {caption as buildCaption} from '../dsl/caption.ts';
import {renderCaption} from '../emit-boxes.ts';
import {layoutBoxLikeBand} from '../layout-box-like.ts';
import {styledAtoms, textRuns} from '../layout-text.ts';
import type {CaptionBand, CaptionOpts, LaidOutCaption, RichText} from '../types/text-bands.ts';
import {boxLikeContrastProblems} from '../verify-box-like.ts';

const definition = {
  type: 'caption',
  internal: true,
  layout: layoutBoxLikeBand,
  measure(data, {atoms, roles}) {
    for (const run of textRuns(data, roles)) {
      for (const {text, weight} of styledAtoms(run)) atoms(text, run.size, weight, run.mono ? 'mono' : 'sans');
    }
  },
  emit: (laid, env) => renderCaption(laid, env.theme, env.tones),
  verify: {check: (laid, {theme, tones}) => boxLikeContrastProblems(laid, null, theme, tones)
    .map(message => ({rule: 'contrast', severity: 'problem', message}))},
} satisfies BandDef<CaptionBand, LaidOutCaption>;

export function caption(text: RichText, opts?: CaptionOpts): WithBandDef<CaptionBand, LaidOutCaption> {
  return band<CaptionBand, LaidOutCaption>(definition, buildCaption(text, opts));
}
