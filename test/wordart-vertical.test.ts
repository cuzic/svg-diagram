import test from 'node:test';
import './helpers/strict-width.ts'; // a text the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {tokenizeColumn, verticalColumns} from '../lib/wordart.ts';
import {rough} from './helpers/wordart.ts';

test('tokens: punctuation and small kana shift, long vowels turn, digits and words are set by their own rules', () => {
  const t = tokenizeColumn('きゃ、ー「A」12。NEW 345　x');
  const kinds = t.map(k => k.kind === 'glyph' ? `${k.ch}${k.turn ? '↻' : ''}${k.dx || k.dy ? '*' : ''}` : k.kind === 'blank' ? '_' : `${k.kind}:${k.text}`);
  assert.deepEqual(kinds, ['き', 'ゃ*', '、*', 'ー↻', '「↻', 'side:A', '」↻', 'tcy:12', '。*', 'side:NEW 345', '_', 'side:x']);
});

test('columns: a newline starts a column; a limit breaks one, and kinsoku hold', () => {
  const cols = (text: string, limit?: number) => verticalColumns(text, 20, 700, rough, {limit}).map(c => c.cells.map(x => x.token.kind === 'glyph' ? x.token.ch : x.token.kind === 'blank' ? '_' : (x.token as {text: string}).text).join(''));
  assert.deepEqual(cols('あい\nうえ'), ['あい', 'うえ']);
  assert.deepEqual(cols('あいうえお', 60), ['あいう', 'えお']);
  assert.deepEqual(cols('あいう、えお', 60), ['あいう、', 'えお'], 'a comma does not start a column');
  assert.deepEqual(cols('あい「うえお」', 60), ['あい', '「うえ', 'お」'], 'an opening bracket never ends a column; a closing one never starts it');
  assert.throws(() => verticalColumns('ABCDEFGHIJ', 20, 700, rough, {limit: 40}), /raise limit/);
});

test('a column is as long as its cells, with the spacing between them', () => {
  const [c] = verticalColumns('あいう', 20, 700, rough, {spacing: 4});
  assert.equal(Math.round(c!.len), 3 * 20 + 2 * 4);
  assert.deepEqual(c!.cells.map(x => x.top), [0, 24, 48]);
  const [d] = verticalColumns('AB 12', 20, 700, rough);
  assert.ok(Math.abs(d!.cells[0]!.len - rough('AB 12', 20)) < 1e-6); // 'AB 12' is one run set on its side: its length is its measured width
});

test('limits hold: an opening bracket does not leave an empty column, spacing counts, a mark hangs one cell and no more', () => {
  const lens = (text: string, limit: number, spacing = 0) => verticalColumns(text, 20, 700, rough, {limit, spacing}).map(c => Math.round(c.len));
  // a long word after a bracket: refused, instead of an empty column and a 156px column under a 50px limit
  assert.throws(() => verticalColumns('「ABCDEFGHIJ」', 20, 700, rough, {limit: 50}), /raise limit/);
  assert.throws(() => verticalColumns('あ「ABCDEFGHIJ」', 20, 700, rough, {limit: 50}), /raise limit/);
  for (const c of verticalColumns('あいう「うえお」', 20, 700, rough, {limit: 60})) assert.ok(c.cells.length > 0, 'no empty column');
  // the gap between cells counts: 20 + 10 + 20 + 10 + 20 = 80 does not fit in 75
  assert.ok(lens('あいうえお', 75, 10).every(n => n <= 75.5), `${lens('あいうえお', 75, 10)}`);
  // a long vowel that may not start a column takes the cell before it along, and a run of them is not one ever-growing column
  assert.ok(lens('あーーーーーーーーーー', 60).every(n => n <= 60.5), `${lens('あーーーーーーーーーー', 60)}`);
  assert.ok(lens('あ……………………', 60).every(n => n <= 60.5));
  // a comma hangs below the column (one cell), the second one does not
  const hang = verticalColumns('あいう、え', 20, 700, rough, {limit: 60});
  assert.deepEqual(hang.map(c => c.cells.length), [4, 1]);
  assert.ok(Math.round(hang[0]!.len) === 80, 'the comma hangs past the limit');
  assert.ok(verticalColumns('あいう、、え', 20, 700, rough, {limit: 60}).every(c => c.len <= 80.5));
});

test('kinsoku hold in the corners: no column starts with a closing mark or ends with an opening bracket when it can be helped', () => {
  const cols = (text: string) => verticalColumns(text, 20, 700, rough, {limit: 60}).map(c => c.cells.map(x => x.token.kind === 'glyph' ? x.token.ch : (x.token as {text: string}).text).join(''));
  assert.deepEqual(cols('あ「ABC」'), ['あ', '「ABC」'], 'the bracket goes with its word, the closing one hangs');
  assert.deepEqual(cols('あいう。。'), ['あい', 'う。。'], 'the second stop takes the first one and the cell before it along');
  assert.deepEqual(cols('あいう。」'), ['あい', 'う。」']);
  assert.deepEqual(cols('あい」」」'), ['あい', '」」」'], 'a run of marks takes two cells along, the rest stays together');
  assert.deepEqual(cols('「「「「あ'), ['「「「', '「あ'], 'brackets only: nothing to carry them with');
  assert.deepEqual(cols('あいうー'), ['あいうー'], 'a long vowel hangs');
  assert.deepEqual(cols('あいうえーー'), ['あいう', 'えーー']);
  assert.deepEqual(cols('éあ'), ['éあ'], 'a letter with its accent is one cell');
});

test('a bracket carried to a word that fits only alone does not make the word too long', () => {
  const cols = verticalColumns('あ「ABCDE」です', 20, 700, rough, {limit: 70});
  assert.ok(cols.every(c => c.cells.length > 0));
  assert.ok(cols.some(c => c.cells.some(x => x.token.kind === 'side' && (x.token as {text: string}).text === 'ABCDE')));
  assert.throws(() => verticalColumns('あ「ABCDEFGHIJ」', 20, 700, rough, {limit: 70}), /raise limit/, 'a word that is too long alone still throws');
});
