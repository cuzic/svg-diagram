import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {screens as build} from '../dsl/wireframe.ts';
import {renderPrims} from '../emit-tables.ts';
import {placeScreens} from '../layout-wireframes.ts';
import type {ScreensItemInput} from '../strict.ts';
import type {LaidOutScreens, ScreensBand, ScreensOpts} from '../types/wireframe.ts';
import {frameRects} from '../verify-rects.ts';
import {collectTextRequests} from '../wireframe.ts';

export {wf} from '../wireframe.ts';

const definition = {
  type: 'screens',
  internal: true,
  layout: placeScreens,
  ids: data => data.items.flatMap(item => item.id ? [item.id] : []),
  measure(data, {atoms}) {
    for (const [text, size, weight, font] of collectTextRequests(data)) atoms(text, size, weight, font);
  },
  emit: (laid, {theme}) => renderPrims(laid, theme),
  verify: {rects: frameRects},
} satisfies BandDef<ScreensBand, LaidOutScreens>;

export function screens<const Id extends string = never>(items: ScreensItemInput<Id>[], opts?: ScreensOpts): WithBandDef<ReturnType<typeof build<Id>>, LaidOutScreens> {
  const data = build<Id>(items, opts);
  return band<typeof data, LaidOutScreens>(definition, data);
}
