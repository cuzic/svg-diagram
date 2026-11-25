import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {plane as build} from '../dsl/plane.ts';
import {renderPlane} from '../emit-plane.ts';
import {layoutPlane, planeTexts} from '../plane.ts';
import {revealPlane} from '../reveal-plane.ts';
import {fillTextSize} from '../slide-fill-text.ts';
import type {LaidOutPlane, PlaneBand, PlaneOpts} from '../types/figures.ts';
import {planeProblems} from '../verify-plane.ts';

export const planeDefinition: BandDef<PlaneBand, LaidOutPlane> = {
  type: 'plane',
  offGrid: true,
  textSizes: band => [band.labelSize],
  fillTextSize: (data, roles) => fillTextSize(roles, data.labelRole),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of planeTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, canvas, geometryScale}) {
    const sized = canvas && data.labelRole === undefined ? {...data, labelRole: 'note' as const} : data;
    const laid = layoutPlane(sized, x, y, w, widthOf, roles, geometryScale);
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
