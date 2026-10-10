// Greedy line-wrapping over pre-measured break atoms (see measure.ts),
// with basic Japanese kinsoku shori (禁則処理 — line-breaking prohibitions):
// a line must not START with closing punctuation / small kana, and must not
// END with opening punctuation.
//
// This exists because every hand-authored multi-line label in this deck so
// far was split into <text> lines by eyeballing character counts, which at
// least once produced a break in the middle of a word ("独自" / "の表現" —
// day2-10-conformity-bias.svg, found during design review) instead of at a
// legal boundary. Wrapping from measured atoms with kinsoku rules applied
// makes that class of mistake structurally unavailable.
//
// Not a full Unicode line-breaking implementation (no hanging punctuation,
// no JIS X 4051 completeness) — covers the two rules that matter for this
// deck's short UI-label-style text: don't orphan closing punctuation at a
// line start, don't strand opening punctuation at a line end.

import {splitAtoms} from './measure.ts';
import type {WrapOptions} from './types.ts';

const CANNOT_START_LINE = new Set(
  '、。，．・：；！？」』）〕】〉》ゝゞーぁぃぅぇぉっゃゅょァィゥェォッャュョ'.split(''),
);
const CANNOT_END_LINE = new Set('「『（〔【〈《'.split(''));

const isWhitespace = (atom: string): boolean => /^\s+$/.test(atom);

// wrapAtoms(atoms, {maxWidth, atomWidth}) -> string[] (one per rendered line)
// atomWidth: (atomText) => number, typically from measureAtoms()'s `width`.
export function wrapAtoms(atoms: string[], {maxWidth, atomWidth}: WrapOptions): string[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let curWidth = 0;

  for (const atom of atoms) {
    if (atom === '\n') { lines.push(cur); cur = []; curWidth = 0; continue; } // explicit line break
    if (isWhitespace(atom)) {
      if (cur.length === 0) continue; // don't start a line with whitespace
      const w = atomWidth(atom);
      if (curWidth + w <= maxWidth) { cur.push(atom); curWidth += w; }
      else { lines.push(cur); cur = []; curWidth = 0; }
      continue;
    }

    const w = atomWidth(atom);
    if (cur.length === 0 || curWidth + w <= maxWidth) {
      cur.push(atom);
      curWidth += w;
    } else if (CANNOT_START_LINE.has(atom)) {
      // would-be line-start is prohibited punctuation — keep it on the
      // current (now slightly overflowing) line instead of breaking before it.
      cur.push(atom);
      curWidth += w;
    } else {
      lines.push(cur);
      cur = [atom];
      curWidth = w;
    }
  }
  if (cur.length) lines.push(cur);

  // Second pass: an opening bracket stranded at a line's end gets pulled
  // forward onto the next line's start instead.
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const last = line[line.length - 1]!;
    if (line.length > 1 && CANNOT_END_LINE.has(last)) {
      line.pop();
      lines[i + 1]!.unshift(last);
    }
  }

  return lines.map(atomsArr => atomsArr.join('').trimEnd());
}

// Convenience wrapper: wraps a plain string (splitting it into atoms first).
export function wrapText(text: string, opts: WrapOptions): string[] {
  return wrapAtoms(splitAtoms(text), opts);
}
