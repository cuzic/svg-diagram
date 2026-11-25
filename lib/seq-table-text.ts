import {splitAtoms, textWidth} from './atoms.ts';
import {wrapAtoms} from './wrap.ts';
import type {WidthOf, FontFamily, WrapMode} from './types/core.ts';

const LH = 1.4;
export const lineH = (size: number) => size * LH;

export const wrap = (text: string, size: number, weight: number, font: FontFamily, maxW: number, widthOf: WidthOf, mode: WrapMode) =>
  wrapAtoms(splitAtoms(text), {maxWidth: Math.max(20, maxW), atomWidth: (a) => widthOf(a, size, weight, font), mode});
export const textW = (text: string, size: number, weight: number, font: FontFamily, widthOf: WidthOf) => textWidth(widthOf, text, size, weight, font);
