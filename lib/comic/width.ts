// The width rule of comic() / chat() (ADR 0074 D2 step 2): a full-width atom is exactly 1 em and is never measured; any other atom
// (a run of Latin letters or digits) is rounded to 1/4 px and then up to a whole px. This wraps a `WidthOf` and changes no other band's width.
import {FONT} from './constants.ts';
import type {WidthOf} from '../types/core.ts';

/** One full-width character: CJK, kana, full-width forms, and the dashes and the ellipsis a Japanese font draws as a full em. */
export const isFullWidth = (atom: string): boolean => [...atom].length === 1 && /[—―‥…　-ヿ㐀-鿿豈-﫿＀-￯]/.test(atom);
export const isHiragana = (atom: string): boolean => [...atom].length === 1 && /[ぁ-ゟ]/.test(atom);

/** The width of one atom at the comic's text size. The quantizer has a cliff wherever it stands; this one sits at k + 0.125. */
export const comicAtomWidth = (atom: string, widthOf: WidthOf): number => isFullWidth(atom) ? FONT : Math.ceil(Math.round(widthOf(atom, FONT, 400, 'sans') * 4) / 4);
