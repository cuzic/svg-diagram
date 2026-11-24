import {frameLayoutFindings} from '../layout-metrics.ts';
import {childRuns} from '../band-text-sizes.ts';
import {band, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {row as buildRow} from '../dsl/containers.ts';
import {renderRow, rowSvgDefs} from '../emit-boxes.ts';
import {layoutRow} from '../layout-row.ts';
import type {Declares, IdsOf, RowHandleOf} from '../strict.ts';
import type {LaidOutRow, RowBand, RowOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';

export const rowDefinition: BandDef<RowBand, LaidOutRow> = {
  type: 'row',
  svgDefs: rowSvgDefs,
  textSizes: childRuns,
  internal: true,
  layout: layoutRow,
  children: data => data.children,
  verify: {diagramFindings: frameLayoutFindings},
  emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
};

export function row<C extends BoxBand & {readonly [DEF]: object}, const Id extends string = never>(
  children: C[], opts?: RowOpts & {id?: Id},
): WithBandDef<RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>, LaidOutRow> {
  const data = buildRow<C, Id>(children, opts);
  if (data.type !== 'row') throw new Error('bands/row: box() の子を指定してください');
  return band<typeof data, LaidOutRow>(rowDefinition, data);
}
