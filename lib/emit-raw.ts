
import {PALETTE} from './tokens.ts';
import type {LaidOutRaw, RawColorTone} from './types/containers.ts';
import type {Theme} from './types/core.ts';

export function renderRaw(band: LaidOutRaw, day: Theme): string {
  const ctx = {
    x: band.x, y: band.y, w: band.w, h: band.h, day,
    color: (tone: RawColorTone): string => tone === 'accent' ? PALETTE[day].accent
      : tone === 'accent-soft' ? PALETTE[day].soft
      : PALETTE[tone] ?? PALETTE.text, // unknown tones fall back to text at runtime
  };
  return band.draw(ctx);
}
