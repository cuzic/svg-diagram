import {rowItems} from '../inventory-boxes.ts';
import {childRects} from '../verify-rects.ts';
import {frameLayoutFindings} from '../layout-metrics.ts';
import {childRuns} from '../band-text-sizes.ts';
import {band, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {buildMixedRow, normalizeRowChildren} from '../dsl/mixed-row.ts';
import {validateRowOptions} from '../dsl/row-options.ts';
import {renderRow, rowSvgDefs} from '../emit-row.ts';
import {layoutGroupRow} from '../layout-group-row.ts';
import type {Declares, IdsOf, Refers, RefsOf, RowHandleOf} from '../strict.ts';
import type {GroupBand, GroupRowBand, LaidOutRow, RowOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';

export const groupRowDefinition: BandDef<GroupRowBand, LaidOutRow> = {
  type: 'grouprow',
  inventory: rowItems,
  svgDefs: rowSvgDefs,
  textSizes: childRuns,
  internal: true,
  layout: layoutGroupRow,
  children: data => data.children,
  outputTypes: ['row'],
  verify: {rects: childRects, targets: laid => laid.children, diagramFindings: frameLayoutFindings},
  emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
};

export function groupRow<C extends (GroupBand | BoxBand) & {readonly [DEF]: object}, const Id extends string = never>(
  children: C[], opts: RowOpts & {id?: Id} = {},
): WithBandDef<GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>, LaidOutRow> {
  validateRowOptions(opts);
  const normalized = normalizeRowChildren(children);
  if (!normalized.some(child => child?.type === 'group')) throw new Error('bands/group-row: 少なくとも一つの group() を渡してください。箱だけの行には bands/row を使えます');
  const data = buildMixedRow(normalized, opts) as GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
  return band<typeof data, LaidOutRow>(groupRowDefinition, data);
}
