// math(): the layout of a formula that lib/math-tex.ts has already converted to outlines. Pure, so the rendering core can use it.
import type {Theme} from './types/core.ts';
import type {LaidOutMath, MathBand} from './types/math.ts';
import {colorOf, textKeyOf} from './tokens.ts';

/** MathJax's SVG output is drawn in 1000 units per em. */
export const UNITS_PER_EM = 1000;
/** layoutMath()'s width error: fill mode reads it as "this scale is too big" (by type, not by its message, which holds the TeX source). */
export class MathTooWideError extends Error {}

const ceil4 = (v: number): number => Math.ceil(v / 4) * 4;

export function layoutMath(band: MathBand, x: number, y: number, cw: number, size: number, day: Theme): LaidOutMath {
  const scale = size / UNITS_PER_EM, w = band.drawing.w * size, h = band.drawing.h * size;
  if (w > cw) throw new MathTooWideError(`math(): the formula "${band.tex}" is ${Math.ceil(w)}px wide at ${size}px, the column is ${cw}px — use a smaller size or split the formula`);
  const left = band.align === 'left' ? x : band.align === 'right' ? x + cw - w : x + (cw - w) / 2;
  return {type: 'math', id: band.id, x: left, y, w, h: ceil4(h), day, tex: band.tex, alt: band.alt, inner: band.drawing.inner, scale, color: colorOf(textKeyOf(band.tone), day), drawnH: h};
}
