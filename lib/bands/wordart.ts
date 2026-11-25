import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {wordart as build} from '../dsl/wordart.ts';
import {renderWordArt} from '../emit-wordart.ts';
import {paintOf} from '../tokens.ts';
import {layoutWordArt, wordArtTexts} from '../wordart-layout.ts';
import {legibilityProblem} from '../wordart-look.ts';
import type {LaidOutWordArt, WordArtBand, WordArtOpts} from '../wordart-types.ts';

const definition = {
  type: 'wordart',
  selfDimming: true,
  offGrid: true,
  title: data => [2, data.text],
  textSizes: band => [band.size],
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of wordArtTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const laid = layoutWordArt(data, x, y, w, widthOf, roles, wrap);
    return {laid, h: laid.h};
  },
  emit: (laid, {theme}) => renderWordArt(laid, theme, !!laid.dim),
  verify: {
    check(laid, {theme, tones}) {
      const why = legibilityProblem(laid.look, theme, paintOf(tones, undefined));
      return why ? [{rule: 'wordart', severity: 'problem', message: `wordart "${laid.text.slice(0, 20)}": ${why}`}] : [];
    },
  },
} satisfies BandDef<WordArtBand, LaidOutWordArt>;

export function wordart<const Id extends string = never>(text: string, opts?: WordArtOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutWordArt> {
  const data = build<Id>(text, opts);
  return band<typeof data, LaidOutWordArt>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const wordartDefinition: BandDef<WordArtBand, LaidOutWordArt> = definition;
