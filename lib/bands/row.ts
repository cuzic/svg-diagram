import {steps as buildSteps} from '../steps.ts';
import {nameBoxChildren} from '../emit-node-ids.ts';
import type {StepItem, StepsOpts} from '../steps.ts';
import {boxDefinition} from './box.ts';
import {rowLoopBack} from '../loop-back-source.ts';
import {rowItems} from '../inventory-boxes.ts';
import {childRects} from '../verify-rects.ts';
import {frameLayoutFindings} from '../layout-metrics.ts';
import {childRuns} from '../band-text-sizes.ts';
import {band, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {boxRow as buildRow} from '../dsl/box-row.ts';
import {rowSpotlight, renderRow, rowSvgDefs} from '../emit-row.ts';
import {layoutRow} from '../layout-row.ts';
import type {Declares, IdsOf, RowHandleOf} from '../strict.ts';
import type {LaidOutRow, RowBand, RowOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';

export const rowDefinition: BandDef<RowBand, LaidOutRow> = {
  type: 'row',
  selfDimming: true,
  spotlight: rowSpotlight,
  loopBackSource: rowLoopBack,
  inventory: rowItems,
  svgDefs: rowSvgDefs,
  textSizes: childRuns,
  internal: true,
  layout: layoutRow,
  children: data => data.children,
  verify: {rects: childRects, targets: laid => laid.children, diagramFindings: frameLayoutFindings},
  emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
  nameNodes: nameBoxChildren,
};

export function row<C extends BoxBand & {readonly [DEF]: object}, const Id extends string = never>(
  children: C[], opts?: RowOpts & {id?: Id},
): WithBandDef<RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>, LaidOutRow> {
  const data = buildRow<C, Id>(children, opts);
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
