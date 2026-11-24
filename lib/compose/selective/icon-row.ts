import {band} from '../../band-def.ts';
import {boxDefinition} from '../../bands/box.ts';
import {rowDefinition} from '../../bands/row.ts';
import type {RowOpts} from '../../types/containers.ts';
import {iconRow as build} from '../icon-row.ts';
import type {IconRowItem} from '../icon-row.ts';

export type {IconRowItem} from '../icon-row.ts';

export function iconRow(items: IconRowItem[], opts?: RowOpts) {
  const data = build(items, opts);
  return band(rowDefinition, {...data, children: data.children.map(child => band(boxDefinition, child))});
}
