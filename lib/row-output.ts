import {nameBoxChildren} from './emit-node-ids.ts';
import {rowItems} from './inventory-boxes.ts';
import {childRects} from './verify-rects.ts';
import {frameLayoutFindings} from './layout-metrics.ts';
import {childRuns} from './band-text-sizes.ts';
import type {BandDef} from './band-def.ts';
import {rowSpotlight, renderRow, rowSvgDefs} from './emit-row.ts';
import type {LaidOutRow, RowBand} from './types/containers.ts';

/**
 * A placed `row` (what areas() and grouprow() lay their cells out as), without the row() builder's own parts: the definition
 * `outputDefinitions` of the bands that place rows points at, so a figure with an areas() has the row's hooks (node ids, rects, drawing).
 */
export const rowOutputDefinition: Extract<BandDef<RowBand, LaidOutRow>, {internal: true}> = {
  type: 'row',
  selfDimming: true,
  spotlight: rowSpotlight,
  inventory: rowItems,
  svgDefs: rowSvgDefs,
  textSizes: childRuns,
  internal: true,
  layout: () => { throw new Error('a placed row is laid out by the band that places it'); },
  children: data => data.children,
  verify: {rects: childRects, targets: laid => laid.children, diagramFindings: frameLayoutFindings},
  emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
  nameNodes: nameBoxChildren,
};
