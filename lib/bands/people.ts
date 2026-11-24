import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {people as build} from '../dsl/people.ts';
import {renderPeople} from '../emit-people.ts';
import {snapGrid} from '../layout-util.ts';
import {layoutPeople, peopleTexts} from '../people.ts';
import type {LaidOutPeople, PeopleBand, PeopleOpts} from '../types/people-dots.ts';

const definition = {
  type: 'people',
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of peopleTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, theme, roles}) {
    const laid = layoutPeople(data, x, snapGrid(y), w, widthOf, theme, roles);
    return {laid, h: laid.h};
  },
  emit: (laid, {theme, tones}) => renderPeople(laid, theme, tones),
} satisfies BandDef<PeopleBand, LaidOutPeople>;

export function people<const Id extends string = never>(total: number, count: number | readonly [number, number], opts?: PeopleOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutPeople> {
  const data = build<Id>(total, count, opts);
  return band<typeof data, LaidOutPeople>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const peopleDefinition: BandDef<PeopleBand, LaidOutPeople> = definition;
