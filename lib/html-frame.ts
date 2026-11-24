import {resolveBoxStyle} from './box-style.ts';
import {px} from './html-document.ts';
import {PALETTE} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme, EmphasisTone, Rect} from './types/core.ts';

// emit.ts snaps shapes (not text) to a 4px grid; the same here, so a box sits where its SVG twin does
const snap4 = (n: number): number => Math.round(n / 4) * 4;

export function shape(r: Rect, o: {tone?: EmphasisTone; dashed?: boolean; dim?: boolean}, day: Theme, tones: ToneEnv, fallbackTone: EmphasisTone): string {
  const st = resolveBoxStyle(tones, o.tone ?? fallbackTone, day, o.dashed);
  let {fill, stroke} = st;
  let line = st.dashed ? 'dashed' : 'solid';
  if (o.dim) { fill = PALETTE.bg; stroke = PALETTE.muted; line = 'dotted'; }
  // The SVG strokes 2.5px centred on the edge: the outer edge is 1.25px out, the outer radius 8 + 1.25. A CSS border is rounded to
  // whole device pixels (2.5px draws as 2px), so a solid outline is an inset box-shadow, which is not; a dashed one has to be a border.
  const outline = line === 'solid' ? `box-shadow:inset 0 0 0 2.5px ${stroke}` : `border:2.5px ${line} ${stroke}`;
  return `<div class="sd-b" style="left:${px(snap4(r.x) - 1.25)};top:${px(snap4(r.y) - 1.25)};width:${px(snap4(r.x + r.w) - snap4(r.x) + 2.5)};height:${px(snap4(r.h) + 2.5)};background:${fill};${outline}"></div>`;
}
