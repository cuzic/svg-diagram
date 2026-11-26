import {layoutBoxLike} from '../layout-box-like.ts';
import {groupItems} from '../inventory-boxes.ts';
import {frameLayoutFindings} from '../layout-metrics.ts';
import {stampProblems} from '../verify-box-like.ts';
import {band, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {group as buildGroup} from '../dsl/group.ts';
import {renderGroup} from '../emit-group.ts';
import {layoutGroup} from '../layout-group.ts';
import {groupTitleBand} from '../layout-util.ts';
import type {GroupBand, GroupOpts, LaidOutGroup} from '../types/containers.ts';
import type {Band} from '../types/index.ts';
import {captionDefinition} from './caption.ts';

type SelectedBand = Band & {readonly [DEF]: object};

export const groupDefinition: BandDef<GroupBand, LaidOutGroup> = {
  type: 'group',
  selfDimming: true,
  mapLoopBackChildren(data, expand) { data.children = expand(data.children); },
  inventory: groupItems,
  title: data => data.title ? [1, data.title] : undefined,
  internal: true,
  layoutBoxLike,
  layout: layoutGroup,
  children: data => data.children,
  stackWidth: (data, width) => width - 2 * (data.pad ?? 16),
  generated: data => data.title ? [band(captionDefinition, groupTitleBand(data))] : [],
  measure(data, {atoms, roles}) {
    if (data.stamp) { atoms(data.stamp, roles.note, 400); atoms([...data.stamp].join(' '), roles.note, 400); } // and each character: a word wider than the chip is broken per character
  },
  verify: {rects: () => [], targets: laid => laid.stampOver ? [laid] : [], // a group's contents are its targets; its own frame only when its stamp needs checking (stamp-too-wide)
    diagramFindings: frameLayoutFindings, check: laid => stampProblems(laid).map(message => ({rule: 'stamp-too-wide', severity: 'problem' as const, message}))},
  emit: (laid, env) => renderGroup(laid, env.theme, env.tones, env.roles),
  locations: {drawsFrame: laid => laid.frame !== false},
};

export function group<C extends SelectedBand | SelectedBand[], const Id extends string = never>(
  children: C, opts?: GroupOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildGroup<C, Id>>, LaidOutGroup> {
  const data = buildGroup<C, Id>(children, opts);
  return band<typeof data, LaidOutGroup>(groupDefinition, data);
}
