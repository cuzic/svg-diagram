import type {SpotlightHooks} from './band-def.ts';
import {renderTextRuns} from './emit-common.ts';
import type {ToneEnv} from './tokens.ts';
import type {Align, Theme} from './types/core.ts';
import type {LaidOutCaption, CaptionBand} from './types/text-bands.ts';

export function captionTextPlacement(band: LaidOutCaption): {originX: number; originY: number; w: number; align: Align} {
  return {originX: band.x, originY: band.y, w: band.w, align: band.align ?? 'center'};
}

export function renderCaption(band: LaidOutCaption, day: Theme, tones: ToneEnv): string {
  return renderTextRuns(band.wrappedRuns, {...captionTextPlacement(band), day, tones, dim: band.dim});
}

export const captionSpotlight: SpotlightHooks<CaptionBand, LaidOutCaption> = {
  dim(laid, focus) {
    // The title and pinned source line are furniture.
    if (!laid.sourceLine && !laid.titleLine) laid.dim = !focus.contains(laid);
  },
};
