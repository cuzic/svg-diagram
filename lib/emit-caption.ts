import {renderTextRuns} from './emit-common.ts';
import type {ToneEnv} from './tokens.ts';
import type {Align, Theme} from './types/core.ts';
import type {LaidOutCaption} from './types/text-bands.ts';

export function captionTextPlacement(band: LaidOutCaption): {originX: number; originY: number; w: number; align: Align} {
  return {originX: band.x, originY: band.y, w: band.w, align: band.align ?? 'center'};
}

export function renderCaption(band: LaidOutCaption, day: Theme, tones: ToneEnv): string {
  return renderTextRuns(band.wrappedRuns, {...captionTextPlacement(band), day, tones, dim: band.dim});
}
