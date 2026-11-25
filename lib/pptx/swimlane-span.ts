import type {LaidOutOf} from '../band-table.ts';
import type {PlanSpan} from './adapter.ts';
import {groupXml} from './shapes.ts';

/** Put lanes and steps in the same group, with a subgroup for the lanes (ADR 0054 D9.2). */
export const swimlaneSpan: PlanSpan<LaidOutOf<'swimlane'>> = (band, {ctx, following, drawBand, drawChildren}) => {
  const count = band.span ?? 0;
  if (count <= 0 || count > following.length) return undefined;
  const drawn = drawBand();
  const name = (/ name="(swimlane[^"]*)"/.exec(drawn)?.[1] ?? 'swimlane')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  const lanes = drawn.replace(/ name="swimlane[^"]*"/, ' name="lanes"');
  const steps = drawChildren(count, false);
  return {xml: groupXml(ctx.next(), name, band, lanes + steps), count};
};
