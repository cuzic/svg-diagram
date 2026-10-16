import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, hero, renderDiagram, stat} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

type Line = {text: string; role?: string; tone?: string};
const svgOf = async (b: ReturnType<typeof stat>) => (await renderDiagram(diagram({theme: 'blue'}).add(b), {name: 's.svg', budget: 'cacheOnly'})).svg;

test('stat({source, confidence}) adds a third line with a symbol and a word; without source nothing changes (ADR 0023 D7-D8)', async () => {
  assert.equal(stat('76%', '離脱率').lines!.length, 2);
  assert.equal(stat('76%', '離脱率', {confidence: undefined}).lines!.length, 2);
  assert.equal(await svgOf(stat('76%', '離脱率')), await svgOf(stat('76%', '離脱率', {source: undefined})));
  for (const [c, text] of [['primary', '◎ 一次資料'], ['secondary', '○ 報道・二次資料'], ['unverified', '△ 未確認']] as const) {
    const b = stat('76%', '離脱率', {source: '総務省 2025', confidence: c});
    assert.equal(b.lines!.length, 3);
    assert.equal((b.lines![2] as unknown as Line).text, '出典: 総務省 2025  ' + text);
    assert.equal((b.lines![2] as unknown as Line).role, 'note');
    assert.equal((b.lines![2] as unknown as Line).tone, 'muted');
  }
  assert.equal((stat('76%', 'x', {source: '社内調査'}).lines![2] as unknown as Line).text, '出典: 社内調査');
  assert.match(await svgOf(stat('76%', '離脱率', {source: '総務省', confidence: 'primary'})), /一次資料/);
});

test('stat({confidence}) without a source throws; a bad confidence or a multi-line source throws', () => {
  assert.throws(() => stat('76%', 'x', {confidence: 'primary'}), /confidence needs a source/);
  assert.throws(() => stat('76%', 'x', {source: 's', confidence: '◎' as never}), /confidence must be/);
  assert.throws(() => stat('76%', 'x', {source: 'a\nb'}), /one-line/);
  assert.throws(() => stat('76%', 'x', {source: ''}), /one-line/);
});

test('the source line is not shrunk and the box grows taller (ADR 0024 does not touch it)', async () => {
  const laid = async (o: object) => (await checkDiagram(diagram({theme: 'blue', width: 220}).add(stat('12345678901', '値', {size: 'display', ...o})))).laidOut.laidOut.find(x => x.type === 'box')!;
  const [a, b] = [await laid({}), await laid({source: '出典', confidence: 'secondary'})];
  assert.ok(b.h > a.h);
  assert.deepEqual(b.statShrunk, a.statShrunk);
  assert.equal(b.wrappedRuns[2].size, 14);
  assert.equal(b.wrappedRuns[0].size, a.wrappedRuns[0].size);
});

test('hero({stat: {source, confidence}}) passes the evidence line through to stat()', async () => {
  const via = diagram({theme: 'blue'}).add(hero({stat: {value: '76%', label: '離脱率', source: '総務省', confidence: 'primary'}, flow: [box({title: 'a'})]}));
  const {svg} = await renderDiagram(via, {name: 'h.svg', budget: 'cacheOnly'});
  assert.match(svg, /出典: 総務省/);
  assert.match(svg, /一次資料/);
  assert.throws(() => hero({stat: {value: 1, label: 'x', confidence: 'primary'}, flow: [box({title: 'a'})]}), /confidence needs a source/);
});

test("stat({confidenceStyle: 'text', confidenceLabels}): the word without its symbol, or the author's own wording", () => {
  const third = (o: object) => (stat('76%', '離脱率', {source: '総務省', confidence: 'secondary', ...o}).lines![2] as unknown as Line).text;
  assert.equal(third({confidenceStyle: 'text'}), '出典: 総務省  報道・二次資料');
  assert.equal(third({confidenceStyle: 'symbol'}), '出典: 総務省  ○ 報道・二次資料');
  assert.equal(third({confidenceLabels: {secondary: '二次資料（報道）'}}), '出典: 総務省  二次資料（報道）');
  assert.equal(third({confidenceStyle: 'text', confidenceLabels: {primary: 'x'}}), '出典: 総務省  報道・二次資料'); // other confidences' labels do not leak
  assert.throws(() => third({confidenceStyle: 'plain'}), /confidenceStyle/);
  assert.throws(() => third({confidenceLabels: {sure: 'x'}}), /confidenceLabels/);
  assert.throws(() => third({confidenceLabels: {primary: ''}}), /confidenceLabels/);
});
