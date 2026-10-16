import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {steps, connect, diagram, checkDiagram, closeMeasurer} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const loops = (a: object, b: object) => diagram({theme: 'blue', title: 't'}).add(
  steps([{title: '調べる'}, {title: '直す'}, {title: '確かめる'}, {title: '出す'}, {title: '振り返る'}], {id: 's'}),
  connect('s#4:bottom', 's#2:bottom', {route: 'loop-under', label: 'a', ...a}),
  connect('s#5:bottom', 's#1:bottom', {route: 'loop-under', label: 'b', ...b}),
);
const crossing = (a: object, b: object) => diagram({theme: 'blue', title: 't'}).add(
  steps([{title: '調べる'}, {title: '直す'}, {title: '確かめる'}, {title: '出す'}], {id: 's'}),
  connect('s#4:bottom', 's#2:bottom', {route: 'loop-under', label: 'a', ...a}),
  connect('s#3:bottom', 's#1:bottom', {route: 'loop-under', label: 'b', ...b}),
);
const crossFinding = async (d: ReturnType<typeof diagram>) => (await checkDiagram(d)).verdict.findings.find(f => f.rule === 'edge-crossings')?.message ?? '';

test('edge-crossings names the loop-under pair and says what to do: dip for nested spans, re-aim for partial overlap or a crossing', async () => {
  assert.match(await crossFinding(loops({}, {})), /戻り s#4→s#2 と s#5→s#1 が同じ高さで重なる。外側の戻りに dip を書く/);
  assert.equal(await crossFinding(loops({}, {dip: 60})), '', 'nested with the outer dip changed: clean');
  assert.match(await crossFinding(crossing({}, {})), /範囲が半端に重なる。dip を変えると交差になる/);
  assert.match(await crossFinding(crossing({}, {dip: 60})), /交差する（dip では消えない）/);
});
