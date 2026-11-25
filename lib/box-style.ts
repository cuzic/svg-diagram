import {colorOf, toneStyle} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {EmphasisTone, Theme} from './types/core.ts';

export interface BoxStyle {fill: string; stroke: string; dashed: boolean}

export function resolveBoxStyle(tones: ToneEnv, tone: EmphasisTone | undefined, day: Theme, dashedOverride?: boolean): BoxStyle {
  const t = toneStyle(tones, tone);
  // doc themes (string keys) use a stroke that reaches 3:1 against the page; the slide decks keep the pale border
  const stroke = typeof day === 'string' ? t.stroke : t.slideStroke ?? t.stroke;
  return {fill: colorOf(t.fill, day), stroke: colorOf(stroke ?? t.fill, day), dashed: dashedOverride ?? t.dashed};
}
