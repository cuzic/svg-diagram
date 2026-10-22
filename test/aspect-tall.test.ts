import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, row} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const stack = (n: number) => Array.from({length: n}, (_, i) => box({title: `項目 ${i + 1}`, body: `説明 ${i + 1}`}));
const findings = async (n: number) => (await checkDiagram(diagram({theme: 'blue', title: 't'}).add(...stack(n)))).verdict.findings.filter(f => f.rule === 'aspect-tall');

test('a document figure taller than 1.5 widths gets an info that says how to shorten it; a squat one does not', async () => {
  assert.deepEqual(await findings(3), []);
  const tall = await findings(30);
  assert.equal(tall.length, 1);
  assert.equal(tall[0]!.severity, 'info');
  assert.match(tall[0]!.message, /縦横比 \d\.\d\d/);
  assert.match(tall[0]!.message, /図を 2 つに分ける/);
});

test('the advice follows the parts: row / group stacks suggest cols, a cause tree suggests fold', async () => {
  const rows = diagram({theme: 'blue', title: 't'}).add(...Array.from({length: 30}, (_, i) => row([box({title: `a${i}`, body: 'x'}), box({title: `b${i}`, body: 'y'})])));
  const r = (await checkDiagram(rows)).verdict.findings.find(f => f.rule === 'aspect-tall');
  assert.match(r?.message ?? '', /row\(\{cols\}\)/);
  assert.doesNotMatch(r?.message ?? '', /causeTree/);
});
