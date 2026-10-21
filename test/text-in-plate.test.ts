import test from 'node:test';
import assert from 'node:assert/strict';
import {closeMeasurer, diagram, renderDiagram, stateDiagram} from '../lib/dsl.ts';
import {badgeSvg, pillSvg} from '../lib/badge.ts';

test.after(() => closeMeasurer());

// A plate is drawn on the 4px grid; the text on it was placed against the unsnapped plate, so it slid up to 2px
// (with a font whose box is taller, such as Noto Sans JP, its top then touched the plate: lint's "text spilling out of its enclosing box").

test('a state label keeps one distance from its snapped plate, wherever the plate lands on the grid', async () => {
  const d = diagram({theme: 'blue'}).add(stateDiagram(
    [{id: 'a', label: '受付'}, {id: 'b', label: '入金'}, {id: 'c', label: '出荷'}, {id: 'd', label: '完了'}],
    [{from: 'a', to: 'b', label: '支払い'}, {from: 'b', to: 'c', label: '確認'}, {from: 'c', to: 'd', label: '配達'}, {from: 'c', to: 'a', label: '差し戻し'}],
  ));
  const {svg} = await renderDiagram(d, {name: 's.svg', budget: 'cacheOnly'});
  const pairs = [...svg.matchAll(/<rect x="[\d.-]+" y="([\d.-]+)" width="[\d.-]+" height="22" fill="#ffffff"\/>\s*<text [^>]*y="([\d.-]+)"/g)].map(m => Number(m[2]) - Number(m[1]));
  assert.ok(pairs.length >= 4, `found ${pairs.length} labels`);
  assert.deepEqual([...new Set(pairs)], [16]);
});

test('pillSvg moves the baseline with the snapped rect when it is told the unsnapped y', () => {
  const o = {x: 0, w: 40, h: 24, fill: '#fff', cx: 20, baseline: 17, text: '#000', size: 14, labelHtml: 'x'};
  assert.match(pillSvg({...o, y: 4}), /y="17"/); // no rawY: as before
  assert.match(pillSvg({...o, y: 4, rawY: 2}), /y="19"/); // the rect moved down 2: so does the text
  assert.match(pillSvg({...o, y: 0, rawY: 2}), /y="15"/);
});

test('badgeSvg centres its number on the circle as drawn (snapped), not on the unsnapped centre', () => {
  const snap = (n: number) => Math.round(n / 4) * 4;
  const o = {shape: 'circle' as const, r: 11, w: 22, label: '1', aria: 'a', size: 14, fill: '#1d5fa8', snap, esc: (s: string) => s};
  assert.match(badgeSvg({...o, cx: 40, cy: 157}), /<circle [^>]*cy="156"[^>]*\/>\s*<text [^>]*y="161"/); // 156 + 14 * 0.36, rounded
  assert.match(badgeSvg({...o, cx: 40, cy: 154}), /<circle [^>]*cy="156"[^>]*\/>\s*<text [^>]*y="161"/);
});
