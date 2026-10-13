import test from 'node:test';
import assert from 'node:assert/strict';
import {splitAtoms} from '../lib/atoms.ts';
import {setWrapMode, wrapText} from '../lib/wrap.ts';
import {box, row} from '../lib/dsl.ts';

const opts = (maxWidth: number) => ({maxWidth, atomWidth: (a: string) => 10 * [...a].length});

test('phrase wrapping keeps a katakana run whole', () => {
  assert.deepEqual(wrapText('作業アプリ', opts(40)), ['作業', 'アプリ']);
  assert.deepEqual(wrapText('LLフック', opts(40)), ['LL', 'フック']);
});

test('phrase wrapping keeps a kanji run whole', () => {
  assert.deepEqual(wrapText('これは独自表現', opts(50)), ['これは', '独自表現']);
});

test('a run wider than a line still breaks per character', () => {
  assert.deepEqual(wrapText('アプリケーション', opts(50)), ['アプリケー', 'ション']);
});

test("'char' mode may break inside a katakana run", () => {
  const prev = setWrapMode('char');
  try { assert.deepEqual(wrapText('開発アプリ', opts(40)), ['開発ア', 'プリ']); } finally { setWrapMode(prev); }
});

test('atoms are unchanged: only the breaking differs', () => {
  assert.deepEqual(splitAtoms('アプリ'), ['ア', 'プ', 'リ']);
});

test('row({cols: 12}) with unplaced children shares the grid equally', () => {
  const r = row([box({title: 'a'}), box({title: 'b'}), box({title: 'c'})], {cols: 12});
  assert.deepEqual(r.children.map(c => c.span), [4, 4, 4]);
  const placed = row([box({title: 'a', span: 1}), box({title: 'b'})], {cols: 12});
  assert.deepEqual(placed.children.map(c => c.span), [1, undefined]);
});
