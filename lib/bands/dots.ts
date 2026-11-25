import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {dots as build} from '../dsl/dots.ts';
import {renderDots} from '../emit-dots.ts';
import {snapGrid} from '../layout-util.ts';
import {layoutDots, dotsTexts} from '../layout-dots.ts';
import type {LaidOutDots, DotsBand, DotsOpts, DotDatum} from '../types/people-dots.ts';

const definition = {
  type: 'dots',
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of dotsTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, theme, roles}) {
    const laid = layoutDots(data, x, snapGrid(y), w, widthOf, theme, roles);
    return {laid, h: laid.h};
  },
  emit: (laid, {theme, tones}) => renderDots(laid, theme, tones),
} satisfies BandDef<DotsBand, LaidOutDots>;

export function dots<const Id extends string = never>(values: readonly DotDatum[], opts?: DotsOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutDots> {
  const data = build<Id>(values, opts);
  return band<typeof data, LaidOutDots>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const dotsDefinition: BandDef<DotsBand, LaidOutDots> = definition;
