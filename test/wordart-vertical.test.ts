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
  assert.equal(Math.round(c.len), 3 * 20 + 2 * 4);
  assert.deepEqual(c.cells.map(x => x.top), [0, 24, 48]);
  const [d] = verticalColumns('AB 12', 20, 700, rough);
  assert.ok(Math.abs(d.cells[0].len - rough('AB 12', 20)) < 1e-6); // 'AB 12' is one run set on its side: its length is its measured width
});
