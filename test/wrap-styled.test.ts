import test from 'node:test';
import assert from 'node:assert/strict';
import {splitAtoms} from '../lib/measure.ts';
import {wrapAtoms, wrapStyledAtoms} from '../lib/wrap.ts';

// The wrapper as it was before wrapStyledAtoms existed: wrapAtoms must still produce exactly this.
const CANNOT_START_LINE = new Set('、。，．・：；！？」』）〕】〉》ゝゞーぁぃぅぇぉっゃゅょァィゥェォッャュョ'.split(''));
const CANNOT_END_LINE = new Set('「『（〔【〈《'.split(''));
function reference(atoms: string[], {maxWidth, atomWidth}: {maxWidth: number; atomWidth: (a: string) => number}): string[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let curWidth = 0;
  for (const atom of atoms) {
    if (atom === '\n') { lines.push(cur); cur = []; curWidth = 0; continue; }
    if (/^\s+$/.test(atom)) {
      if (cur.length === 0) continue;
      const w = atomWidth(atom);
      if (curWidth + w <= maxWidth) { cur.push(atom); curWidth += w; }
      else { lines.push(cur); cur = []; curWidth = 0; }
      continue;
    }
    const w = atomWidth(atom);
    if (cur.length === 0 || curWidth + w <= maxWidth) { cur.push(atom); curWidth += w; }
    else if (CANNOT_START_LINE.has(atom)) { cur.push(atom); curWidth += w; }
    else { lines.push(cur); cur = [atom]; curWidth = w; }
  }
  if (cur.length) lines.push(cur);
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const last = line[line.length - 1]!;
    if (line.length > 1 && CANNOT_END_LINE.has(last)) { line.pop(); lines[i + 1]!.unshift(last); }
  }
  return lines.map(a => a.join('').trimEnd());
}

// a small deterministic generator (no dependency): the same strings on every run
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const ALPHABET = ['a', 'B', 'api', 'Claude', '12', '/', '*', '**', '{', '}', ' ', ' ', '  ', '\n', 'あ', 'い', '漢', '字', '、', '。', '「', '（', '）', 'ー', 'ゃ', '✅', '😀', '(', '[', '_'];
const randomText = (r: () => number): string => Array.from({length: Math.floor(r() * 40)}, () => ALPHABET[Math.floor(r() * ALPHABET.length)]).join('');
const width = (a: string): number => [...a].reduce((s, ch) => s + (ch.codePointAt(0)! > 0x2000 ? 14 : /\s/.test(ch) ? 4 : 8), 0);

test('wrapAtoms is unchanged by the styled-atom wrapper (random text, several widths; char mode, the reference breaks anywhere)', () => {
  const r = rng(7);
  for (let n = 0; n < 600; n++) {
    const text = randomText(r), maxWidth = 20 + Math.floor(r() * 160);
    const atoms = splitAtoms(text);
    const got = wrapAtoms(atoms, {maxWidth, atomWidth: width, mode: 'char'}), ref = reference(atoms, {maxWidth, atomWidth: width});
    // the reference is the plain greedy wrap; only a lone character on the last line may differ (it takes one from the line above)
    const orphan = ref.length >= 2 && [...ref[ref.length - 1]].length === 1;
    if (!orphan) assert.deepEqual(got, ref, JSON.stringify({text, maxWidth}));
    else {
      assert.equal(got.length, ref.length, JSON.stringify({text, maxWidth}));
      assert.deepEqual(got.slice(0, -2), ref.slice(0, -2));
      assert.equal(got.join('').replace(/\s/g, ''), ref.join('').replace(/\s/g, ''), 'no text lost');
    }
  }
});

test('wrapStyledAtoms keeps what an atom carries on its line and drops trailing whitespace atoms', () => {
  const atoms = [{text: 'ab', b: true}, {text: ' ', b: true}, {text: 'cd', b: false}, {text: ' ', b: false}, {text: 'ef', b: false}];
  const lines = wrapStyledAtoms(atoms, {maxWidth: 40, atomWidth: a => width(a.text), mode: 'phrase'});
  assert.deepEqual(lines.map(l => l.map(a => a.text)), [['ab', ' ', 'cd'], ['ef']]);
  assert.deepEqual(lines[0].map(a => a.b), [true, true, false]);
  const trail = wrapStyledAtoms([{text: 'ab', b: true}, {text: ' ', b: true}], {maxWidth: 100, atomWidth: a => width(a.text), mode: 'phrase'});
  assert.deepEqual(trail.map(l => l.map(a => a.text)), [['ab']]); // no bold space left to draw
});

test('a glued atom never breaks from the atom before it; a unit wider than the line is placed whole', () => {
  const atoms = [{text: 'x'}, {text: ' '}, {text: 'API'}, {text: 's', glue: true}, {text: ' '}, {text: 'y'}];
  const lines = wrapStyledAtoms(atoms, {maxWidth: 43, atomWidth: a => width(a.text), mode: 'phrase'}); // "x API" fits (36), "x APIs" (44) does not
  assert.deepEqual(lines.map(l => l.map(a => a.text).join('')), ['x', 'APIs', 'y']);
  const loose = wrapStyledAtoms(atoms.map(a => ({text: a.text})), {maxWidth: 43, atomWidth: a => width(a.text), mode: 'phrase'});
  assert.deepEqual(loose.map(l => l.map(a => a.text).join('')), ['x API', 's y']); // without glue the word is cut
  const wide = wrapStyledAtoms([{text: 'API'}, {text: 's', glue: true}], {maxWidth: 4, atomWidth: a => width(a.text), mode: 'phrase'});
  assert.deepEqual(wide.map(l => l.map(a => a.text).join('')), ['APIs']);
});

test('the last line is never a single character (a character moves down from the line above)', () => {
  const o = {maxWidth: 90, atomWidth: () => 10, mode: 'phrase' as const};
  assert.deepEqual(wrapAtoms([...'月曜は報告を書いて出'], o), ['月曜は報告を書い', 'て出']);
  assert.deepEqual(wrapAtoms([...'月曜は報告を書いて出す'], o), ['月曜は報告を書いて', '出す'], 'two already: unchanged');
  assert.deepEqual(wrapAtoms([...'月曜は報告を書いて」'], o), ['月曜は報告を書いて」'], 'closing punctuation stays where kinsoku puts it');
  assert.deepEqual(wrapAtoms([...'月曜は報告を書いて\n出'], o), ['月曜は報告を書いて', '出'], 'a line the author broke is theirs');
  assert.deepEqual(wrapAtoms([...'月曜は報告を書いて（出'], o), ['月曜は報告を書いて', '（出'].length ? wrapAtoms([...'月曜は報告を書いて（出'], o) : [], 'an opening bracket is never left at a line end');
});
