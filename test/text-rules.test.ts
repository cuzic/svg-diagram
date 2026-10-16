import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {midWordBreaks, midWordBreaksIn} from '../lib/text-rules.ts';

test.after(() => closeMeasurer());

test('midWordBreaks: katakana and Latin words split across lines; a space or a newline in the source is the author\'s break', () => {
  assert.deepEqual(midWordBreaks(['コンテキス', 'ト'], 'コンテキスト'), [{before: 'ンテキス', after: 'ト'}]);
  assert.deepEqual(midWordBreaks(['configurat', 'ion'], 'configuration'), [{before: 'urat', after: 'ion'}]);
  assert.deepEqual(midWordBreaks(['load', 'balancer'], 'load balancer'), []);
  assert.deepEqual(midWordBreaks(['コンテキスト', 'の切替'], 'コンテキストの切替'), []);
  assert.deepEqual(midWordBreaks(['リフレッシュ', 'ルール'], 'リフレッシュ\nルール'), []);
  assert.deepEqual(midWordBreaks(['認知', '負荷'], '認知負荷'), []); // kanji are not judged
  assert.deepEqual(midWordBreaks(['コンテキス', 'ト']), [{before: 'ンテキス', after: 'ト'}]); // no source text: katakana only
  assert.deepEqual(midWordBreaks(['abc', 'def']), []);
});

test('midWordBreaksIn: lines kept as positioned entries of one label are joined by position', () => {
  const t = (text: string, x: number, y: number) => ({text, x, y, size: 14});
  assert.equal(midWordBreaksIn({texts: [t('コンテ', 10, 20), t('キスト', 10, 40)]}).length, 1);
  assert.equal(midWordBreaksIn({texts: [t('コンテ', 10, 20), t('キスト', 90, 40)]}).length, 0); // another column
  assert.equal(midWordBreaksIn({texts: [t('コンテ', 10, 20), t('キスト', 10, 200)]}).length, 0); // far below
});

test('text-mid-word-break: a causeTree narrower than its longest katakana word is reported; a wide one is not', async () => {
  const nodes = [{id: 'a', label: 'コンテキストスイッチングの増加'}, {id: 'b', label: 'リフレッシュ遅延'}];
  const find = async (maxNodeW: number) => (await checkDiagram(diagram({theme: 'blue'}).add(causeTree(nodes, [{from: 'a', to: 'b'}], {maxNodeW})))).verdict.findings.filter(f => f.rule === 'text-mid-word-break');
  assert.equal((await find(80)).length, 1);
  assert.equal((await find(400)).length, 0);
});
