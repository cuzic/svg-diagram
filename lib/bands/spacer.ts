import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {spacer as buildSpacer} from '../dsl/spacer.ts';
import type {SpacerBand} from '../types/containers.ts';
import type {Rect} from '../types/core.ts';

export const spacerDefinition: BandDef<SpacerBand, Rect> = {
  type: 'spacer',
  internal: true,
  layout(data, ctx) { ctx.y += data.h; },
  emit: () => '',
};

export function spacer(height: number): WithBandDef<SpacerBand, Rect> {
  return band<SpacerBand, Rect>(spacerDefinition, buildSpacer(height));
}
