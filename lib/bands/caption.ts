import {sourceLineFindings} from '../verify-caption.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {caption as buildCaption} from '../dsl/caption.ts';
import {renderCaption} from '../emit-boxes.ts';
import {layoutBoxLikeBand} from '../layout-box-like.ts';
import {styledAtoms, textRuns} from '../layout-text.ts';
import type {CaptionBand, CaptionOpts, LaidOutCaption, RichText} from '../types/text-bands.ts';
import {boxLikeContrastProblems} from '../verify-box-like.ts';

export const captionDefinition: BandDef<CaptionBand, LaidOutCaption> = {
  type: 'caption',
  title: data => data.text ? [0, data.text] : undefined,
  internal: true,
  layout: layoutBoxLikeBand,
  measure(data, {atoms, roles}) {
    for (const run of textRuns(data, roles)) {
      for (const {text, weight} of styledAtoms(run)) atoms(text, run.size, weight, run.mono ? 'mono' : 'sans');
    }
  },
  emit: (laid, env) => renderCaption(laid, env.theme, env.tones),
  verify: {
    layoutFindings: sourceLineFindings,
    contrast: (laid, {theme, tones, appearance}) => boxLikeContrastProblems(laid, null, theme, tones, appearance),
  },
};

export function caption(text: RichText, opts?: CaptionOpts): WithBandDef<CaptionBand, LaidOutCaption> {
  return band<CaptionBand, LaidOutCaption>(captionDefinition, buildCaption(text, opts));
}
