import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {raw as buildRaw} from '../dsl/text-bands.ts';
import {renderRaw} from '../emit-boxes.ts';
import {layoutRaw} from '../layout-raw.ts';
import type {LaidOutRaw, RawBand, RawOpts} from '../types/containers.ts';

const definition = {
  type: 'raw',
  internal: true,
  layout: layoutRaw,
  emit: (laid, env) => renderRaw(laid, env.theme),
} satisfies BandDef<RawBand, LaidOutRaw>;

export function raw(opts: RawOpts): WithBandDef<RawBand, LaidOutRaw> {
  return band<RawBand, LaidOutRaw>(definition, buildRaw(opts));
}
