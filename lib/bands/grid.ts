import {unionOf} from '../figure-metrics.ts';
import {layoutBoxLike} from '../layout-box-like.ts';
import {childBoxes} from '../inventory-boxes.ts';
import {canvasRegionFindings} from '../verify-grid.ts';
import {childRects} from '../verify-rects.ts';
import {frameLayoutFindings} from '../layout-metrics.ts';
import {childRuns} from '../band-text-sizes.ts';
import {band, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {grid as buildGrid} from '../dsl/grid.ts';
import {childTextSvgDefs} from '../emit-box-defs.ts';
import {renderGrid} from '../emit-grid.ts';
import {layoutGridBand} from '../layout-grid.ts';
import type {GridBand, LaidOutGrid, GridOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';

export const gridDefinition: BandDef<GridBand, LaidOutGrid> = {
  type: 'grid',
  inventory: childBoxes,
  svgDefs: childTextSvgDefs,
  textSizes: childRuns,
  internal: true,
  layoutBoxLike,
  layout: layoutGridBand,
  children: data => data.children,
  verify: {rects: childRects, figureExtent: laid => unionOf(laid.children), targets: laid => laid.children, diagramFindings: frameLayoutFindings, findings: canvasRegionFindings},
  emit: (laid, env) => renderGrid(laid, env.theme, env.tones, env.roles, env.stage),
};

export function grid<C extends BoxBand & {readonly [DEF]: object}>(children: C[], opts: GridOpts): WithBandDef<ReturnType<typeof buildGrid<C>>, LaidOutGrid> {
  const data = buildGrid(children, opts);
  return band<typeof data, LaidOutGrid>(gridDefinition, data);
}
