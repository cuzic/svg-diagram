import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, cycle, diagram} from '../lib/dsl.ts';
import {katakanaWidth} from '../lib/tree.ts';
import type {LaidOutFlowShape} from '../lib/flow-shapes.ts';

test.after(() => closeMeasurer());

const radii = async (labels: string[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(cycle(labels.map(label => ({label})))));
  const shape = laidOut.laidOut.find((b): b is LaidOutFlowShape => b.type === 'cycle')!;
  return {r: shape.primitives.filter(p => p.k === 'circle').map(p => (p as {r: number}).r), h: shape.h, problems: verdict.problems};
};

test('a cycle with short words is drawn as it always was (circles of 54, height 520)', async () => {
  const {r, h} = await radii(['計画', '実行', '評価']);
  assert.deepEqual([...new Set(r)], [54]);
  assert.equal(h, 520);
});

test('circles grow for a katakana word that the label area would cut, and the ring and height follow', async () => {
  const {r, h, problems} = await radii(['ストレスチェック', '職場改善', '振り返り', 'モニタリング', '評価', '計画']);
  assert.ok(Math.min(...r) > 54, `circles grew (got ${r[0]})`);
  assert.ok(h > 520 && h <= 760, `height ${h}`);
  assert.deepEqual(problems, []);
});

test('katakanaWidth is the widest katakana run of a text', () => {
  const widthOf = (a: string) => a.length * 10;
  assert.equal(katakanaWidth('モニタリングと計画', widthOf, 14, 700), 60);
  assert.equal(katakanaWidth('漢字だけ', widthOf, 14, 700), 0);
});
