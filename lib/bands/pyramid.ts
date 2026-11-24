import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {pyramid as build} from '../dsl/pyramid.ts';
import {renderPyramid} from '../emit-pyramid.ts';
import {layoutPyramid} from '../layout-pyramid.ts';
import type {PyramidLayers} from '../strict.ts';
import type {PyramidBand, PyramidOpts, LaidOutPyramid} from '../types/figures.ts';

const definition = {
  type: 'pyramid',
  internal: true,
  layout: layoutPyramid,
  measure(data, {atoms, roles}) {
    for (const layer of data.layers) atoms(layer.text, roles.title, 700);
  },
  emit: (laid, env) => renderPyramid(laid, env.roles),
} satisfies BandDef<PyramidBand, LaidOutPyramid>;

export function pyramid(layers: PyramidLayers, opts?: PyramidOpts): WithBandDef<PyramidBand, LaidOutPyramid> {
  return band<PyramidBand, LaidOutPyramid>(definition, build(layers, opts));
}

/** @internal Definition used by the full renderer. */
export const pyramidDefinition: BandDef<PyramidBand, LaidOutPyramid> = definition;
