import {band, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {row as buildRow} from '../dsl/containers.ts';
import {renderRow} from '../emit-boxes.ts';
import {layoutGroupRow} from '../layout-group-row.ts';
import type {Declares, IdsOf, Refers, RefsOf, RowHandleOf} from '../strict.ts';
import type {GroupBand, GroupRowBand, LaidOutRow, RowOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';

const definition = {
  type: 'grouprow',
  internal: true,
  layout: layoutGroupRow,
  children: data => data.children,
  outputTypes: ['row'],
  emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
} satisfies BandDef<GroupRowBand, LaidOutRow>;

export function groupRow<C extends (GroupBand | BoxBand) & {readonly [DEF]: object}, const Id extends string = never>(
  children: C[], opts?: RowOpts & {id?: Id},
): WithBandDef<GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>, LaidOutRow> {
  const data = buildRow<C, Id>(children, opts);
  if (data.type !== 'grouprow') throw new Error('bands/group-row: 少なくとも一つの group() を渡してください。箱だけの行には bands/row を使えます');
  return band<typeof data, LaidOutRow>(definition, data);
}
