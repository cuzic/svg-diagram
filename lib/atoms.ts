// Splitting text into break atoms and summing their widths: pure, no I/O. The measuring itself (fonts, Chromium) is measure.ts.
import type {FontFamily, WidthOf} from './types.ts';

import {must} from './must.ts';
function isCJK(ch: string): boolean {
  const c = must(ch.codePointAt(0));
  return (c >= 0x3000 && c <= 0x30ff)   // CJK punctuation, hiragana, katakana
    || (c >= 0x3400 && c <= 0x9fff)      // CJK unified ideographs (+ ext A)
    || (c >= 0xf900 && c <= 0xfaff)      // CJK compatibility ideographs
    || (c >= 0xff00 && c <= 0xffef);     // fullwidth forms
}

// Splits text into atoms: each CJK character alone, each run of whitespace
// alone, and each run of anything else (Latin words, digits, punctuation,
// emoji) kept together.
export function splitAtoms(text: string): string[] {
  const atoms: string[] = [];
  let buf = '';
  const flush = () => { if (buf) { atoms.push(buf); buf = ''; } };
  for (const ch of text) {
    if (isCJK(ch)) { flush(); atoms.push(ch); }
    else if (/\s/.test(ch)) { flush(); atoms.push(ch); }
    else { buf += ch; }
  }
  flush();
  return atoms;
}

/** Width of single-line text: the sum of its atoms' measured widths. The one place this sum is written. */
export function textWidth(widthOf: WidthOf, text: string, size: number, weight: number, font: FontFamily = 'sans'): number {
  let w = 0;
  for (const atom of splitAtoms(text)) w += widthOf(atom, size, weight, font);
  return w;
}
