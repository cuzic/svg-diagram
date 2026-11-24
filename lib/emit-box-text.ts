import {renderTextRuns} from './emit-common.ts';
import {BOX_PAD_X, BOX_PAD_Y} from './layout-util.ts';
import type {ToneEnv} from './tokens.ts';
import type {Align, Theme} from './types/core.ts';
import type {LaidOutBanner, LaidOutBox} from './types/text-bands.ts';

export function boxTextPlacement(band: LaidOutBox | LaidOutBanner): {originX: number; originY: number; w: number; align: Align} {
  const align = band.align ?? (band.type === 'banner' || band.iconAt === 'top' ? 'center' : 'left');
  const px = band.padX ?? BOX_PAD_X, py = band.padY ?? BOX_PAD_Y;
  return {originX: band.x + px, originY: band.y + py, w: band.w - 2 * px, align};
}


export function renderBoxText(band: LaidOutBox | LaidOutBanner, day: Theme, tones: ToneEnv): string {
  return renderTextRuns(band.wrappedRuns, {...boxTextPlacement(band), day, tones, dim: band.dim, boxTone: band.tone});
}
