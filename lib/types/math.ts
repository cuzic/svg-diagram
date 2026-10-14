// Types: math() (a TeX formula).
import type {Rect, Role, TextTone, Theme} from './core.ts';

export interface MathOpts {
  /** The text role whose size the formula is set at (default 'body'): the formula scales with the rest of the text in fill mode. */
  role?: Role;
  /** Inline style (`\\textstyle`: fractions and limits set small, as inside a sentence) instead of display style (default). */
  inline?: boolean;
  align?: 'left' | 'center' | 'right';
  tone?: TextTone;
  /** The accessible name (default: the TeX source). Say it in words when the formula is not obvious to a reader who cannot see it. */
  alt?: string;
  id?: string;
}
export interface MathBand {
  type: 'math';
  tex: string;
  /** The converted formula (lib/math.ts): outlines and the box they fill, in em. */
  drawing: {inner: string; w: number; h: number};
  role: Role;
  align: 'left' | 'center' | 'right';
  tone: TextTone;
  alt: string;
  id?: string;
}
export interface LaidOutMath extends Rect {
  type: 'math'; id?: string; day: Theme; tex: string; alt: string;
  /** The outlines, to be drawn at `scale` (px per MathJax unit) with the box's top-left at the origin. */
  inner: string; scale: number; color: string;
  /** The height the outlines fill; `h` is that rounded up to the 4px grid. */
  drawnH: number;
}
