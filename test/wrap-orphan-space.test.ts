// wrap: the orphan fix (a single character left alone on the last line brings the character above it down) kept the characters but dropped
// the white space between them: 'G H' became 'GH', which merged two words.
import test from 'node:test';
import assert from 'node:assert/strict';
import {wrapText} from '../lib/wrap.ts';

const TEN = (atom: string) => [...atom].length * 10; // every character 10px wide
const wrap = (text: string, maxWidth: number) => wrapText(text, {maxWidth, atomWidth: TEN, mode: 'phrase'});

test("the orphan fix keeps the space between the moved word and the orphan ('G H', not 'GH')", () => {
  const lines = wrap('A  B C D E F G H', 60);
  assert.deepEqual(lines, ['A  B C', 'D E F', 'G H']);
});

test('property: wrapping never merges or splits the words of a Latin text, whatever the width', () => {
  let seed = 12345;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let k = 0; k < 600; k++) {
    const words = Array.from({length: 2 + rnd(14)}, () => 'ABCDEFG'.slice(0, 1 + rnd(3)));
    const text = words.join(' '), width = 30 + rnd(8) * 10;
    const lines = wrap(text, width);
    assert.deepEqual(lines.join(' ').split(/\s+/), words, `"${text}" at ${width}px became ${JSON.stringify(lines)}`);
  }
});

test('a text without spaces (Japanese) is wrapped as before: the fix moves one character and nothing else', () => {
  const lines = wrap('書いて出すまでに時間がかかる', 90);
  assert.equal(lines.join(''), '書いて出すまでに時間がかかる');
  assert.ok(lines.every(l => [...l].length >= 2), `no orphan: ${JSON.stringify(lines)}`);
});
