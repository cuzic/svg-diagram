import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {checkDiagram, closeMeasurer, diagram, mindmap, tree} from '../lib/dsl.ts';
import {validateSpec} from '../lib/spec.ts';
import type {LaidOutTree, TreeItem} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

// A typical slide mind map: 8 branches of 12 characters, two leaves each, on a 900px figure (invented wording).
const word = (i: number, len: number): string => '施策項目の整理と共有の手順を決める進め方'.repeat(2).slice(i % 5, (i % 5) + len);
const branches = (n: number, len: number): TreeItem[] => Array.from({length: n}, (_, i) => ({label: word(i, len), children: [{label: word(i + 1, len)}, {label: word(i + 2, len)}]}));
const run = async (opts: object, w = 900, n = 8, len = 12) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', title: '進め方の整理', width: w}).add(mindmap({label: '中心テーマ', tone: 'accent', children: branches(n, len)}, opts as never)));
  return {verdict, tree: laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree};
};

test("spec: a mindmap part takes maxNodeW 'auto' or a number (the warning's advice works on the JSON path)", () => {
  const spec = (maxNodeW: unknown) => ({version: 1, title: '進め方の整理', parts: [{type: 'mindmap', root: {label: 'a', children: [{label: 'b'}]}, maxNodeW}]});
  const bad = (v: unknown): number => validateSpec(spec(v)).filter(i => i.path.includes('maxNodeW')).length;
  assert.equal(bad('auto'), 0);
  assert.equal(bad(160), 0);
  assert.ok(bad('wide') > 0);
});

test("mindmap: maxNodeW left out narrows the nodes with a warning that names maxNodeW (a mind map has no dir)", async () => {
  const {verdict, tree} = await run({});
  const f = verdict.findings.find(x => x.rule === 'auto-fit-applied');
  assert.ok(f && f.severity === 'warn' && tree.fitApplied?.length);
  assert.ok(f.message.includes("maxNodeW: 'auto'") && !f.message.includes("dir: 'auto'") && !f.message.includes('dir / maxNodeW'), f.message);
});

test("mindmap: maxNodeW: 'auto' fits the width and says so as a note, not a warning", async () => {
  const {verdict, tree} = await run({maxNodeW: 'auto'});
  const f = verdict.findings.find(x => x.rule === 'auto-fit-applied');
  assert.ok(f && f.severity === 'info', JSON.stringify(verdict.findings));
  assert.ok(tree.fitApplied?.every(a => a.mode === 'auto'));
  assert.ok(!verdict.findings.some(x => x.severity === 'warn'));
});

test("mindmap: maxNodeW: 'auto' on a roomy figure only widens the nodes (a note, never a warning)", async () => {
  const {verdict, tree} = await run({maxNodeW: 'auto'}, 940, 4, 6);
  assert.ok(tree.fitApplied?.every(a => a.mode === 'auto' && Number(a.to) >= Number(a.from)));
  assert.ok(!verdict.findings.some(x => x.severity === 'warn') && verdict.problems.length === 0);
});

test("mindmap: 'auto' is rejected for a wrong value and tree() never takes it", () => {
  assert.throws(() => mindmap({label: 'a'}, {maxNodeW: 'wide' as never}), /maxNodeW must be a number >= 80 or 'auto'/);
  assert.throws(() => diagram({theme: 'blue'}).add(mindmap({label: 'a'}, {maxNodeW: 40})), /maxNodeW/);
  assert.throws(() => tree({label: 'a'}, {maxNodeW: 'auto' as never}), (e: Error) => /^tree\(\): maxNodeW must be a number >= 80 \(got auto\)$/.test(e.message));
});
