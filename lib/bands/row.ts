import {steps as buildSteps} from '../steps.ts';
import type {StepItem, StepsOpts} from '../steps.ts';
import {boxDefinition} from './box.ts';
import {rowLoopBack} from '../loop-back.ts';
import {rowItems} from '../inventory-boxes.ts';
import {frameLayoutFindings} from '../layout-metrics.ts';
import {childRuns} from '../band-text-sizes.ts';
import {band, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {row as buildRow} from '../dsl/row.ts';
import {renderRow, rowSvgDefs} from '../emit-row.ts';
import {layoutRow} from '../layout-row.ts';
import type {Declares, IdsOf, RowHandleOf} from '../strict.ts';
import type {LaidOutRow, RowBand, RowOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';

export const rowDefinition: BandDef<RowBand, LaidOutRow> = {
  type: 'row',
  loopBackSource: rowLoopBack,
  inventory: rowItems,
  svgDefs: rowSvgDefs,
  textSizes: childRuns,
  internal: true,
  layout: layoutRow,
  children: data => data.children,
  verify: {targets: laid => laid.children, diagramFindings: frameLayoutFindings},
  emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
};

export function row<C extends BoxBand & {readonly [DEF]: object}, const Id extends string = never>(
  children: C[], opts?: RowOpts & {id?: Id},
): WithBandDef<RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>, LaidOutRow> {
  const data = buildRow<C, Id>(children, opts);
  if (data.type !== 'row') throw new Error('bands/row: box() の子を指定してください');
  return band<typeof data, LaidOutRow>(rowDefinition, data);
}

export type {StepItem, StepsOpts} from '../steps.ts';

export function steps<const Id extends string = never>(
  items: StepItem[], opts?: StepsOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildSteps<Id>>, LaidOutRow> {
  const data = buildSteps(items, opts);
  data.children = data.children.map(child => band(boxDefinition, child));
  return band<typeof data, LaidOutRow>(rowDefinition, data);
}
