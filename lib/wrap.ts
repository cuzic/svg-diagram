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

import {splitAtoms} from './atoms.ts';
import type {WrapOptions} from './types/core.ts';

const CANNOT_START_LINE = new Set(
  '、。，．・：；！？」』）〕】〉》ゝゞーぁぃぅぇぉっゃゅょァィゥェォッャュョ'.split(''),
);
const CANNOT_END_LINE = new Set('「『（〔【〈《'.split(''));

const isWhitespace = (atom: string): boolean => /^\s+$/.test(atom);

/** 'phrase' (default): a katakana run and a kanji run are one unit for breaking ('アプリ' is never ア/プ/リ); 'char': any CJK character may end a line. */
export type WrapMode = 'phrase' | 'char';
let wrapMode: WrapMode = 'phrase';
/** Sets the mode for the wrapping that follows (layoutWith sets it from diagram({wrap}) and restores it); returns the previous one. */
export function setWrapMode(mode: WrapMode): WrapMode { const prev = wrapMode; wrapMode = mode; return prev; }

// The script run a one-character atom belongs to: 'k' katakana (with ー ・ and half-width kana), 'h' kanji; '' for anything else.
function scriptRun(atom: string): 'k' | 'h' | '' {
  if ([...atom].length !== 1) return '';
  const c = atom.codePointAt(0)!;
  if ((c >= 0x30a1 && c <= 0x30ff) || (c >= 0xff66 && c <= 0xff9f)) return 'k';
  if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || c === 0x3005) return 'h';
  return '';
}

// wrapStyledAtoms(atoms, {maxWidth, atomWidth}) -> one atom list per rendered line, so whatever an atom carries (a weight, a
// tone: see layout.ts styledAtoms) stays with it onto its line. An atom with `glue` belongs to the atom before it (a Latin word
// that a bold/colour span boundary cut in two): the two are one unit for breaking, so a word is never split between lines;
// a unit wider than a line is placed whole, as a single overlong atom already was. Trailing whitespace atoms are dropped.
export function wrapStyledAtoms<A extends {text: string; glue?: boolean}>(atoms: A[], {maxWidth, atomWidth}: {maxWidth: number; atomWidth: (atom: A) => number}): A[][] {
  const lines: A[][] = [];
  let cur: A[] = [];
  let curWidth = 0;
  let hardBreakBeforeLast = false; // the last line starts after an explicit \n: its length is the author's
  // phrase mode: atom i continues atom i-1 when both sit in one katakana / kanji run (until such a unit is wider than a line: then it breaks per character)
  const runGlue = atoms.map((a, i) => wrapMode === 'phrase' && i > 0 && scriptRun(a.text) !== '' && scriptRun(a.text) === scriptRun(atoms[i - 1].text));

  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    if (atom.text === '\n') { lines.push(cur); cur = []; curWidth = 0; hardBreakBeforeLast = true; continue; } // explicit line break
    if (isWhitespace(atom.text)) {
      if (cur.length === 0) continue; // don't start a line with whitespace
      const w = atomWidth(atom);
      if (curWidth + w <= maxWidth) { cur.push(atom); curWidth += w; }
      else { lines.push(cur); cur = []; curWidth = 0; }
      continue;
    }

    let unit = [atom];
    let j = i;
    while (j + 1 < atoms.length && (atoms[j + 1].glue || runGlue[j + 1])) unit.push(atoms[++j]);
    let w = unit.reduce((s, a) => s + atomWidth(a), 0);
    if (w > maxWidth && j > i) {
      // too long for any line: fall back to the characters (span-glued pieces still stay together)
      for (let k = i + 1; k <= j; k++) runGlue[k] = false;
      j = i;
      unit = [atom];
      while (j + 1 < atoms.length && atoms[j + 1].glue) unit.push(atoms[++j]);
      w = unit.reduce((s, a) => s + atomWidth(a), 0);
    }
    i = j;
    if (cur.length === 0 || curWidth + w <= maxWidth) {
      cur.push(...unit);
      curWidth += w;
    } else if (CANNOT_START_LINE.has(atom.text)) {
      // would-be line-start is prohibited punctuation — keep it on the
      // current (now slightly overflowing) line instead of breaking before it.
      // A katakana run it opens ('・テスト') is not dragged along: the run starts afresh after it.
      const cut = unit.findIndex((a, k) => k > 0 && !a.glue);
      if (cut > 0) {
        i = i - unit.length + cut; // the next iteration starts at the run's first character
        runGlue[i + 1] = false;
        unit = unit.slice(0, cut);
      }
      cur.push(...unit);
      curWidth += unit.reduce((s, a) => s + atomWidth(a), 0);
    } else {
      lines.push(cur);
      cur = unit;
      curWidth = w;
      hardBreakBeforeLast = false;
    }
  }
  if (cur.length) lines.push(cur);
  const runGlued = new Set(atoms.filter((_, k) => runGlue[k])); // still part of a whole katakana / kanji run: the orphan fix must not split it

  // An orphan: the wrap left a single character alone on the last line ("書いて出" / "す"). Bring the last character of the
  // line above down with it, so the last line has two. (Not after an explicit line break; not when it would put a prohibited
  // character at a line start or end, or make the last line wider than the line.)
  if (lines.length >= 2 && !hardBreakBeforeLast) {
    const last = lines[lines.length - 1], prev = lines[lines.length - 2];
    const solo = last.length === 1 && [...last[0].text].length === 1 && !isWhitespace(last[0].text) && !last[0].glue;
    if (solo) {
      let at = prev.length - 1;
      while (at >= 0 && isWhitespace(prev[at].text)) at--;
      const moved = prev[at];
      if (moved && at >= 2 && !moved.glue && !prev[at + 1]?.glue && !runGlued.has(moved) && !CANNOT_END_LINE.has(prev[at - 1].text) && !CANNOT_START_LINE.has(moved.text)
        && atomWidth(moved) + atomWidth(last[0]) <= maxWidth) {
        prev.length = at;            // drops the moved atom and the white space after it
        last.unshift(moved);
      }
    }
  }

  // Second pass: an opening bracket stranded at a line's end gets pulled
  // forward onto the next line's start instead.
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const last = line[line.length - 1]!;
    if (line.length > 1 && CANNOT_END_LINE.has(last.text)) {
      line.pop();
      lines[i + 1]!.unshift(last);
    }
  }

  for (const line of lines) while (line.length && isWhitespace(line[line.length - 1]!.text)) line.pop();
  return lines;
}

// wrapAtoms(atoms, {maxWidth, atomWidth}) -> string[] (one per rendered line)
// atomWidth: (atomText) => number, typically from measureAtoms()'s `width`.
export function wrapAtoms(atoms: string[], {maxWidth, atomWidth}: WrapOptions): string[] {
  return wrapStyledAtoms(atoms.map(text => ({text})), {maxWidth, atomWidth: a => atomWidth(a.text)}).map(line => line.map(a => a.text).join('').trimEnd());
}

// Convenience wrapper: wraps a plain string (splitting it into atoms first).
export function wrapText(text: string, opts: WrapOptions): string[] {
  return wrapAtoms(splitAtoms(text), opts);
}
