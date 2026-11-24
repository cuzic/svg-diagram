import {band} from '../../band-def.ts';
import type {WithBandDef} from '../../band-def.ts';
import {boxDefinition} from '../../bands/box.ts';
import {gridDefinition} from '../../bands/grid.ts';
import {groupDefinition} from '../../bands/group.ts';
import {groupRowDefinition} from '../../bands/group-row.ts';
import {affinity as build} from '../../dsl/affinity.ts';
import type {GroupBand, GroupRowBand, LaidOutGroup, LaidOutRow} from '../../types/containers.ts';

function selectGroup(group: GroupBand): WithBandDef<GroupBand, LaidOutGroup> {
  return band(groupDefinition, {...group, children: group.children.map(child => {
    if (child.type === 'box') return band(boxDefinition, child);
    if (child.type === 'grid') return band(gridDefinition, {...child, children: child.children.map(box => band(boxDefinition, box))});
    if (child.type === 'grouprow') return selectRow(child);
    throw new Error(`affinity(): unexpected child "${child.type}"`);
  })});
}

function selectRow(row: GroupRowBand): WithBandDef<GroupRowBand, LaidOutRow> {
  return band(groupRowDefinition, {...row, children: row.children.map(child => child.type === 'group' ? selectGroup(child) : band(boxDefinition, child))});
}

export const affinity = (...args: Parameters<typeof build>) => build(...args).map(selectRow);

export type {AffinityGroup, AffinityOpts} from '../../dsl/affinity.ts';
