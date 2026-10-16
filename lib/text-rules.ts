// Text that the layout broke in the middle of a word (pure: reads the wrapped lines the layout left on the bands).
// A line break inside a run of katakana ("コンテキス/ト") or of Latin letters and digits reads as a typo. Kanji compounds are not judged: a break
// between two kanji is common and often fine.

import {EMOJI_RE} from './tokens.ts';

const KATAKANA = /[ァ-ヺーㇰ-ㇿｦ-ﾟ]/;
const LATIN = /[A-Za-z0-9]/;
const sameWord = (a: string, b: string): boolean => (KATAKANA.test(a) && KATAKANA.test(b)) || (LATIN.test(a) && LATIN.test(b));

export interface MidWordBreak {before: string; after: string}

/** The word breaks of one wrapped run. With the run's source text, a break where the text has a space or a newline is the author's own; without it only katakana is judged. */
export function midWordBreaks(lines: readonly string[], text?: string): MidWordBreak[] {
  const out: MidWordBreak[] = [];
  let p = 0; // position in `text` after the previous line (when the lines can be matched back to it)
  let matched = text !== undefined;
  for (let k = 0; k + 1 < lines.length; k++) {
    const left = lines[k]!, right = lines[k + 1]!;
    if (!left || !right) { matched = false; continue; }
    let spaced = false;
    if (matched && text !== undefined) {
      let q = p;
      while (q < text.length && /\s/.test(text[q]!)) q++;
      if (!text.startsWith(left, q)) matched = false;
      else {
        p = q + left.length;
        let r = p;
        while (r < text.length && /\s/.test(text[r]!)) r++;
        spaced = r > p;
      }
    }
    if (spaced) continue;
    const a = left[left.length - 1]!, b = right[0]!;
    const word = matched ? sameWord(a, b) : KATAKANA.test(a) && KATAKANA.test(b);
    if (word) out.push({before: left.slice(-4), after: right.slice(0, 4)});
  }
  return out;
}

interface Placed {text: string; x: number; y: number; size: number}
const isPlaced = (o: unknown): o is Placed => typeof o === 'object' && o !== null && typeof (o as Placed).text === 'string' && typeof (o as Placed).x === 'number' && typeof (o as Placed).y === 'number' && typeof (o as Placed).size === 'number';

/** Many bands keep a wrapped label as separate positioned lines, one entry per line: two entries in a row at the same x, one line apart, are the lines of one label. Only katakana is judged (no source text to tell a space from a break). */
function placedBreaks(items: readonly Placed[]): MidWordBreak[] {
  const out: MidWordBreak[] = [];
  for (let k = 0; k + 1 < items.length; k++) {
    const a = items[k]!, b = items[k + 1]!, gap = b.y - a.y;
    if (a.x !== b.x || a.size !== b.size || gap <= 0 || gap > a.size * 2 || !a.text || !b.text) continue;
    if (KATAKANA.test(a.text[a.text.length - 1]!) && KATAKANA.test(b.text[0]!)) out.push({before: a.text.slice(-4), after: b.text.slice(0, 4)});
  }
  return out;
}

/** Every mid-word break in a laid-out tree: a `wrappedRuns` entry (lines + source text) or any plain `lines: string[]`. */
export function midWordBreaksIn(root: unknown): MidWordBreak[] {
  const out: MidWordBreak[] = [], seen = new WeakSet<object>();
  const walk = (o: unknown): void => {
    if (typeof o !== 'object' || o === null || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) {
      if (o.length > 1 && o.every(isPlaced)) out.push(...placedBreaks(o));
      for (const v of o) walk(v);
      return;
    }
    const rec = o as Record<string, unknown>;
    if (Array.isArray(rec.lines) && rec.lines.every(l => typeof l === 'string')) out.push(...midWordBreaks(rec.lines as string[], typeof rec.text === 'string' ? rec.text : undefined));
    for (const v of Object.values(rec)) walk(v);
  };
  walk(root);
  return out;
}

// Pictographs the emitter does not treat as emoji: EMOJI_RE (lib/tokens.ts) is what gets `<tspan class="emoji">` and a colour font, so a
// pictograph outside it ("✅" U+2705, "❌", "⭐" is inside) is drawn with the ordinary text font, which usually has no glyph for it (blank in resvg).
const PICTOGRAPH = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/gu;

/** The pictographs in the text of a laid-out tree that would be drawn with the text font (and may come out blank). */
export function missingGlyphs(root: unknown): string[] {
  const found = new Set<string>(), seen = new WeakSet<object>();
  const scan = (s: string): void => { for (const m of s.matchAll(PICTOGRAPH)) if (!EMOJI_RE.test(m[0])) found.add(m[0]); };
  const walk = (o: unknown, key?: string): void => {
    if (typeof o === 'string') { if (key === 'text' || key === 'lines' || key === 'label' || key === 'title') scan(o); return; }
    if (typeof o !== 'object' || o === null || seen.has(o)) return;
    seen.add(o);
    for (const [k, v] of Array.isArray(o) ? o.map(x => [key, x] as const) : Object.entries(o)) walk(v, k);
  };
  walk(root);
  return [...found];
}
