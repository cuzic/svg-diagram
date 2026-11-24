import {band, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {group as buildGroup} from '../dsl/group.ts';
import {renderGroup} from '../emit-boxes.ts';
import {layoutGroup} from '../layout-group.ts';
import {groupTitleBand} from '../layout-util.ts';
import type {GroupBand, GroupOpts, LaidOutGroup} from '../types/containers.ts';
import type {Band} from '../types/index.ts';
import {captionDefinition} from './caption.ts';

type SelectedBand = Band & {readonly [DEF]: object};

export const groupDefinition: BandDef<GroupBand, LaidOutGroup> = {
  type: 'group',
  internal: true,
  layout: layoutGroup,
  children: data => data.children,
  stackWidth: (data, width) => width - 2 * (data.pad ?? 16),
  generated: data => data.title ? [band(captionDefinition, groupTitleBand(data))] : [],
  measure(data, {atoms, roles}) {
    if (data.stamp) atoms(data.stamp, roles.note, 400);
  },
  emit: (laid, env) => renderGroup(laid, env.theme, env.tones, env.roles),
};

export function group<C extends SelectedBand | SelectedBand[], const Id extends string = never>(
  children: C, opts?: GroupOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildGroup<C, Id>>, LaidOutGroup> {
  const data = buildGroup<C, Id>(children, opts);
  return band<typeof data, LaidOutGroup>(groupDefinition, data);
}
