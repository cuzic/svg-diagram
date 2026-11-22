// The width rule of comic() / chat() (ADR 0074 D2 step 2): a full-width atom is exactly 1 em and is never measured; any other atom
// (a run of Latin letters or digits) is rounded to 1/4 px and then up to a whole px. This wraps a `WidthOf` and changes no other band's width.
import {FONT} from './constants.ts';
import type {FontWeight, WidthOf} from '../types/core.ts';

/** One full-width character: CJK, kana, full-width forms, and the dashes and the ellipsis a Japanese font draws as a full em. */
export const isFullWidth = (atom: string): boolean => [...atom].length === 1 && /[\u2014\u2015\u2025\u2026\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uff60\uffe0-\uffe7]/.test(atom);
export const isHiragana = (atom: string): boolean => [...atom].length === 1 && /[\u3041-\u309f]/.test(atom);

/** The width of one atom. The quantizer has a cliff wherever it stands; this one sits at k + 0.125. */
export const comicAtomWidth = (atom: string, widthOf: WidthOf, size = FONT, weight: FontWeight = 400): number =>
  isFullWidth(atom) ? size : Math.ceil(Math.round(widthOf(atom, size, weight, 'sans') * 4) / 4);
