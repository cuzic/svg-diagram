import {areasPrelayout} from '../layout-areas-gaps.ts';
import {rowItems} from '../inventory-boxes.ts';
import {frameLayoutFindings} from '../layout-metrics.ts';
import {childRuns} from '../band-text-sizes.ts';
import {band, defOf, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {areas as buildAreas} from '../dsl/containers.ts';
import type {AreaContent} from '../dsl/containers.ts';
import {renderRow, rowSvgDefs} from '../emit-row.ts';
import {layoutAreas} from '../layout-areas.ts';
import type {AreasBand, AreasOpts, LaidOutRow} from '../types/containers.ts';
import {groupDefinition} from './group.ts';

const definition = {
  type: 'areas',
  inventory: rowItems,
  svgDefs: rowSvgDefs,
  textSizes: childRuns,
  internal: true,
  layout: layoutAreas,
  areasPrelayout,
  children: data => data.children,
  outputTypes: ['row'],
  verify: {targets: laid => laid.children, diagramFindings: frameLayoutFindings},
  emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
} satisfies BandDef<AreasBand, LaidOutRow>;

export function areas<const C extends Record<string, AreaContent & {readonly [DEF]: object}>, const Id extends string = never>(
  template: string | readonly string[], cells: C, opts?: AreasOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildAreas<C, Id>>, LaidOutRow> {
  const data = buildAreas<C, Id>(template, cells, opts);
  data.children = data.children.map(child =>
    child.type === 'group' && !defOf(child) ? band(groupDefinition, child) : child);
  return band<typeof data, LaidOutRow>(definition, data);
}
