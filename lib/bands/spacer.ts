import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {spacer as buildSpacer} from '../dsl/containers.ts';
import type {SpacerBand} from '../types/containers.ts';
import type {Rect} from '../types/core.ts';

const definition = {
  type: 'spacer',
  internal: true,
  layout(data, ctx) { ctx.y += data.h; },
  emit: () => '',
} satisfies BandDef<SpacerBand>;

export function spacer(height: number): WithBandDef<SpacerBand, Rect> {
  return band<SpacerBand, Rect>(definition, buildSpacer(height));
}
