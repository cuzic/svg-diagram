import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {raw as buildRaw} from '../dsl/raw.ts';
import {renderRaw} from '../emit-raw.ts';
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

/** @internal Definition used by the full renderer. */
export const rawDefinition: BandDef<RawBand, LaidOutRaw> = definition;
