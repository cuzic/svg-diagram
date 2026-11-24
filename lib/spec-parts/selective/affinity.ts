import {band} from '../../band-def.ts';
import type {WithBandDef} from '../../band-def.ts';
import {boxDefinition} from '../../bands/box.ts';
import {gridDefinition} from '../../bands/grid.ts';
import {groupDefinition} from '../../bands/group.ts';
import {groupRowDefinition} from '../../bands/group-row.ts';
import {rowDefinition} from '../../bands/row.ts';
import {affinity as build} from '../../dsl/diagrams.ts';
import type {GroupBand, GroupRowBand, LaidOutGroup, LaidOutRow, RowBand} from '../../types/containers.ts';
import {defineAffinityPart} from '../affinity.ts';

function selectGroup(group: GroupBand): WithBandDef<GroupBand, LaidOutGroup> {
  return band(groupDefinition, {...group, children: group.children.map(child => {
    if (child.type === 'box') return band(boxDefinition, child);
    if (child.type === 'grid') return band(gridDefinition, {...child, children: child.children.map(box => band(boxDefinition, box))});
    if (child.type === 'row' || child.type === 'grouprow') return selectRow(child);
    throw new Error(`affinity(): unexpected child "${child.type}"`);
  })});
}

function selectRow(row: GroupRowBand | RowBand): WithBandDef<GroupRowBand, LaidOutRow> | WithBandDef<RowBand, LaidOutRow> {
  if (row.type === 'row') return band(rowDefinition, {...row, children: row.children.map(child => band(boxDefinition, child))});
  return band(groupRowDefinition, {...row, children: row.children.map(child => child.type === 'group' ? selectGroup(child) : band(boxDefinition, child))});
}

const affinity = (...args: Parameters<typeof build>) => build(...args).map(selectRow);

export const affinityPart = /* @__PURE__ */ defineAffinityPart(affinity);
