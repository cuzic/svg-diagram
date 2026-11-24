import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {plane as build} from '../dsl/plane.ts';
import {renderPlane} from '../emit-figures.ts';
import {layoutPlane, planeTexts} from '../plane.ts';
import {revealPlane} from '../reveal-plane.ts';
import type {LaidOutPlane, PlaneBand, PlaneOpts} from '../types/figures.ts';
import {planeProblems} from '../verify-plane.ts';

export const planeDefinition: BandDef<PlaneBand, LaidOutPlane> = {
  type: 'plane',
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of planeTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles}) {
    const laid = layoutPlane(data, x, y, w, widthOf, roles);
    return {laid, h: laid.h};
  },
  revealElements: revealPlane,
  emit: (laid, {theme, tones, stage}) => renderPlane(laid, theme, tones, stage),
  verify: {
    check: laid => planeProblems(laid).map(message => ({rule: 'plane', severity: 'problem', message})),
  },
};

export function plane<const Id extends string = never>(opts: PlaneOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutPlane> {
  const data = build<Id>(opts);
  return band<typeof data, LaidOutPlane>(planeDefinition, data);
}
