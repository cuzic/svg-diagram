import {at} from './finding-rules.ts';
import {largeImageWarning, plateStyle} from './image.ts';
import {colorOf, luminance as lightLuminance, paintOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {ImageBand, LaidOutImage} from './types/image.ts';
import type {Appearance, Theme} from './types/core.ts';
import {CONTRAST_THRESHOLD, dxdy, eachOverlap, outsideBox} from './verify-base.ts';
import type {CheckRect, Finding} from './types/verdicts.ts';

// image(): a label plate must stay inside the picture and clear of the other plates (it sits on the picture, so a plate over a plate hides words).
export function imageProblems(band: LaidOutImage): string[] {
  const problems: string[] = [];
  for (const p of band.plates) {
    if (outsideBox(p, band)) problems.push(`image: label "${p.text}" does not fit inside the picture (shorten it or make the picture bigger)`);
  }
  eachOverlap(band.plates, (a, b, o) => problems.push(`image: label "${a.text}" overlaps label "${b.text}" by ${dxdy(o)} (move one: its position is a fraction of the picture)`));
  return problems;
}

export function imageContrast(band: LaidOutImage, day: Theme, appearance: Appearance | undefined, tones: ToneEnv): string[] {
  const problems: string[] = [];
  const paint = paintOf(tones, appearance);
  const luminance = (hex: string) => lightLuminance(paint(hex));
  for (const p of band.plates) {
    const st = plateStyle(tones, p.tone), fg = colorOf(st.text, day), bg = colorOf(st.fill, day), delta = Math.abs(luminance(fg) - luminance(bg));
    if (!p.dim && !band.dim && delta < CONTRAST_THRESHOLD) problems.push(`image: label "${p.text}" (${fg} on ${bg}) has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
  }
  return problems;
}

export const imageRects = (band: LaidOutImage): CheckRect[] => [{id: band.id ?? null, label: band.id ?? 'image', x: band.x, y: band.y, w: band.w, h: band.h, holds: band.anchors.map(a => a.id), ...(band.backdrop ? {backdrop: true} : {})}];

export function imageSizeFindings(band: ImageBand): Finding[] {
  const message = largeImageWarning(band.bytes);
  return message ? [{...at(band), rule: 'image-large', severity: 'warn', message}] : [];
}
