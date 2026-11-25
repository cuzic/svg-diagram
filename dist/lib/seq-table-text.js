import { splitAtoms, textWidth } from './atoms.js';
import { wrapAtoms } from './wrap.js';
const LH = 1.4;
export const lineH = (size) => size * LH;
export const wrap = (text, size, weight, font, maxW, widthOf, mode) => wrapAtoms(splitAtoms(text), { maxWidth: Math.max(20, maxW), atomWidth: (a) => widthOf(a, size, weight, font), mode });
export const textW = (text, size, weight, font, widthOf) => textWidth(widthOf, text, size, weight, font);
