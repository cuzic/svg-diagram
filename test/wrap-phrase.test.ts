import test from 'node:test';
import assert from 'node:assert/strict';
import {splitAtoms} from '../lib/atoms.ts';
import {wrapText, type WrapMode} from '../lib/wrap.ts';
import {box, row} from '../lib/dsl.ts';

const opts = (maxWidth: number, mode: WrapMode = 'phrase') => ({maxWidth, atomWidth: (a: string) => 10 * [...a].length, mode});

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
  assert.deepEqual(wrapText('開発アプリ', opts(40, 'char')), ['開発ア', 'プリ']);
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

test('a prohibited line-start that opens a katakana run keeps only itself on the line', () => {
  assert.deepEqual(wrapText('設計・テスト工程', opts(50)), ['設計・', 'テスト工程']);
});

test('the orphan fix does not split a katakana run', () => {
  assert.deepEqual(wrapText('これはアプリ用', opts(60)), ['これはアプリ', '用']);
});

test('row({cols: 12}) with one unplaced child spans the grid', () => {
  assert.deepEqual(row([box({title: 'a'})], {cols: 12}).children.map(c => c.span), [12]);
});
