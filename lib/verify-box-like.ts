import {resolveBoxStyle, resolveTextColor} from './emit-common.ts';
import {luminance as lightLuminance, paintOf, PALETTE, runColorOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Appearance, EmphasisTone, Theme} from './types/core.ts';
import type {LaidOutBanner, LaidOutBox, LaidOutCaption} from './types/text-bands.ts';
import {CONTRAST_THRESHOLD, labelOf} from './verify-base.ts';

export function nowrapProblems(b: LaidOutBox): string[] {
  return (b.nowrapOverflow ?? []).map(o => `stat: value "${o.value}" does not fit its box even at the smallest size (${o.min}px: needs ${Math.ceil(o.width)}px, the box has ${Math.floor(o.avail)}px).\n  fix: widen the box (span / flex / width), shorten the value, or put the unit in the label.`);
}

export function boxLikeContrastProblems(band: LaidOutBox | LaidOutBanner | LaidOutCaption, boxTone: EmphasisTone | null, theme: Theme, tones: ToneEnv, appearance?: Appearance): string[] {
  const problems: string[] = [];
  const paint = paintOf(tones, appearance);
  const luminance = (hex: string) => lightLuminance(paint(hex));
  const boxFill = band.dim ? PALETTE.bg : boxTone ? resolveBoxStyle(tones, boxTone, theme).fill : PALETTE.bg;
  for (const run of band.wrappedRuns ?? []) {
    const fg = band.dim ? PALETTE.muted : runColorOf(tones, run.tone, boxTone ?? undefined, theme); // dim first: a dimmed solid box is white
    const delta = Math.abs(luminance(fg) - luminance(boxFill));
    if (delta < CONTRAST_THRESHOLD) {
      problems.push(`"${run.text.slice(0, 20)}" (${fg} on ${boxFill}, in "${labelOf(band)}") has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
    }
    // a coloured piece of the run is its own text colour on the same fill (a dimmed box paints every piece muted: the run's check covers it)
    if (!band.dim) for (const sp of run.spans ?? []) {
      if (!sp.tone) continue;
      const spanFg = resolveTextColor(tones, sp.tone, theme), spanDelta = Math.abs(luminance(spanFg) - luminance(boxFill));
      if (spanDelta < CONTRAST_THRESHOLD) problems.push(`"${sp.text.slice(0, 20)}" (${spanFg} on ${boxFill}, in "${labelOf(band)}") has low contrast (delta=${spanDelta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
    }
  }
  return problems;
}
