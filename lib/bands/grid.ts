import {band, DEF} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {grid as buildGrid} from '../dsl/containers.ts';
import {renderGrid} from '../emit-boxes.ts';
import {layoutGridBand} from '../layout-grid.ts';
import type {GridBand, LaidOutGrid, GridOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';

export const gridDefinition: BandDef<GridBand, LaidOutGrid> = {
  type: 'grid',
  internal: true,
  layout: layoutGridBand,
  children: data => data.children,
  emit: (laid, env) => renderGrid(laid, env.theme, env.tones, env.roles, env.stage),
};

export function grid<C extends BoxBand & {readonly [DEF]: object}>(children: C[], opts: GridOpts): WithBandDef<ReturnType<typeof buildGrid<C>>, LaidOutGrid> {
  const data = buildGrid(children, opts);
  return band<typeof data, LaidOutGrid>(gridDefinition, data);
}
