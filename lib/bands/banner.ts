import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {banner as buildBanner} from '../dsl/banner.ts';
import {renderBanner} from '../emit-boxes.ts';
import {layoutBoxLikeBand} from '../layout-box-like.ts';
import {styledAtoms, textRuns} from '../layout-text.ts';
import type {BannerBand, BannerOpts, LaidOutBanner} from '../types/text-bands.ts';
import {boxLikeContrastProblems} from '../verify-box-like.ts';

export const bannerDefinition: BandDef<BannerBand, LaidOutBanner> = {
  type: 'banner',
  internal: true,
  layout: layoutBoxLikeBand,
  measure(data, {atoms, roles}) {
    if (data.stamp) atoms(data.stamp, roles.note, 400);
    for (const run of textRuns(data, roles)) {
      for (const {text, weight} of styledAtoms(run)) atoms(text, run.size, weight, run.mono ? 'mono' : 'sans');
    }
  },
  emit: (laid, env) => renderBanner(laid, env.theme, env.tones, env.roles),
  verify: {contrast: (laid, {theme, tones, appearance}) => boxLikeContrastProblems(laid, laid.tone ?? 'accent', theme, tones, appearance)},
};

export function banner<const Id extends string = never>(opts: BannerOpts & {id?: Id}): WithBandDef<ReturnType<typeof buildBanner<Id>>, LaidOutBanner> {
  const data = buildBanner<Id>(opts);
  return band<typeof data, LaidOutBanner>(bannerDefinition, data);
}
