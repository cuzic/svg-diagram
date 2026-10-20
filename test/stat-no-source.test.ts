import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, hero, renderDiagram, row, stat} from '../lib/dsl.ts';
import {RULE_DOCS} from '../lib/rules.ts';

test.after(() => closeMeasurer());

const found = async (opts: object, ...bands: unknown[]) =>
  (await checkDiagram(diagram({theme: 'blue', ...opts}).add(...(bands as never[])))).verdict.findings.filter(f => f.rule === 'stat-no-source');

test('stat-no-source is documented and does not run unless evidenceCheck is written', async () => {
  assert.ok('stat-no-source' in RULE_DOCS);
  assert.deepEqual(await found({}, stat('76%', '離脱率')), []);
});

test("evidenceCheck 'info' reports info, 'strict' reports warn; the message has the number and no coordinates", async () => {
  const [i] = await found({evidenceCheck: 'info'}, stat('76%', '離脱率'));
  assert.equal(i!.severity, 'info');
  assert.match(i!.message, /76%/);
  assert.match(i!.message, /source/);
  assert.doesNotMatch(i!.message, /px/);
  const [w] = await found({evidenceCheck: 'strict'}, stat('76%', '離脱率'));
  assert.equal(w!.severity, 'warn');
});

test('a stat with a source is not reported; each stat without one is, inside a row and hero too', async () => {
  assert.deepEqual(await found({evidenceCheck: 'strict'}, stat('76%', 'a', {source: '総務省'})), []);
  assert.deepEqual(await found({evidenceCheck: 'strict'}, stat('76%', 'a', {source: '総務省', confidence: 'unverified'})), []);
  const f = await found({evidenceCheck: 'info'}, row([stat('1%', 'a'), stat('2%', 'b', {source: 's'}), stat('3%', 'c')]));
  assert.equal(f.length, 2);
  assert.match(f[0]!.message, /1%/);
  assert.match(f[1]!.message, /3%/);
  assert.equal((await found({evidenceCheck: 'info'}, hero({stat: {value: '9', label: 'x'}, flow: [box({title: 'a'})]}))).length, 1);
  assert.deepEqual(await found({evidenceCheck: 'info'}, box({title: '数字 76%'})), []);
});

test('accept keeps stat-no-source as an info with the reason', async () => {
  const [f] = await found({evidenceCheck: 'strict', accept: {'stat-no-source': '社内の数字'}}, stat('76%', 'a'));
  assert.equal(f!.severity, 'info');
  assert.match(f!.message, /許容: 社内の数字/);
});

test('evidenceCheck never changes the drawing and a bad value throws', async () => {
  const draw = async (o: object) => (await renderDiagram(diagram({theme: 'blue', ...o}).add(stat('76%', 'a')), {name: 'e.svg', budget: 'cacheOnly'})).svg;
  assert.equal(await draw({evidenceCheck: 'strict'}), await draw({}));
  assert.throws(() => diagram({theme: 'blue', evidenceCheck: 'warn' as never}), /evidenceCheck/);
});
