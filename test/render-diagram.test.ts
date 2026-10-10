// renderDiagram(): the part of build() short of the disk. It reports a failed verification instead of throwing, so
// `svg-diagram show` can still draw the picture; build() keeps its contract (throw, write nothing).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {diagram, row, box, connect, build, renderDiagram, closeMeasurer} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const crowded = () => diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左', body: '本文'}), box({id: 'b', title: '右', body: '本文'})], {gap: 24}), connect('a:right', 'b:left', {label: '長めのラベルです', chip: true, route: 'elbow'}));

test('renderDiagram returns the SVG and the verdict even when verification fails; build() throws and writes nothing', async () => {
  const r = await renderDiagram(crowded(), {name: 'x.svg', budget: 'cacheOnly'});
  assert.equal(r.verdict.ok, false);
  assert.match(r.svg, /^<svg\b/);
  assert.deepEqual(r.xml, []);
  assert.equal(r.budgetSource, null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-diagram-'));
  const out = path.join(dir, 'x.svg');
  await assert.rejects(build(crowded(), out, {lint: false}), /layout verification failed/);
  assert.equal(fs.existsSync(out), false);
  fs.rmSync(dir, {recursive: true});
});

test('a good diagram renders, build() writes the same bytes, and it is well-formed XML', async () => {
  const mk = () => diagram({theme: 'blue'}).add(box({title: '見出し', body: '本文 & <記号>'}));
  const r = await renderDiagram(mk(), {name: 'ok.svg', budget: 'cacheOnly'});
  assert.equal(r.verdict.ok, true);
  assert.deepEqual(r.xml, []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-diagram-'));
  const out = path.join(dir, 'ok.svg');
  await build(mk(), out, {lint: false});
  assert.equal(fs.readFileSync(out, 'utf8'), r.svg);
  fs.rmSync(dir, {recursive: true});
});

test("a slide that has no cached budget is drawn at the default size with a note, and starts no dev server (cacheOnly)", async () => {
  const d = diagram({theme: 'blue', slide: {page: 'no-such-page.md', heading: 'x'}}).add(box({title: 'a'}));
  const r = await renderDiagram(d, {name: 'nocache.svg', budget: 'cacheOnly'});
  assert.equal(r.budgetSource, 'default');
  assert.equal(r.budget, null);
  assert.match(r.notes.join('\n'), /未計測/);
  const f = diagram({theme: 'blue', fill: true, slide: {page: 'no-such-page.md', heading: 'x'}}).add(box({title: 'a'}));
  const rf = await renderDiagram(f, {name: 'nocache-fill.svg', budget: 'cacheOnly'});
  assert.match(rf.notes.join('\n'), /fill: true/);
});

test('fill: true with a slide budget draws a table at the scaled font size (emit reads ROLES, so it must run before they are restored)', async () => {
  const {slideCacheKeyForTest} = await import('./helpers/slide-fixture.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-fill-'));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    slideCacheKeyForTest(dir, {maxHeight: 900, contentWidth: 800});
    const {table, cell} = await import('../lib/dsl.ts');
    const slide = {page: 'pages/p.md', heading: '見出し'};
    const mk = (fill: boolean) => (fill ? diagram({day: 2, fill: true, slide}) : diagram({day: 2, slide})).add(table([{label: '方式'}, {label: '結果'}], [['A', cell('通る')], ['B', cell('条件付き')]]));
    const sizes = (svg: string) => [...svg.matchAll(/font-size="(\d+)"/g)].map(m => Number(m[1]));
    const plain = await renderDiagram(mk(false), {name: 'p.svg', budget: 'cacheOnly'});
    const filled = await renderDiagram(mk(true), {name: 'p.svg', budget: 'cacheOnly'});
    assert.equal(filled.budgetSource, 'cache');
    assert.ok((filled.fontScale ?? 1) > 1, `expected a font scale above 1, got ${filled.fontScale}`);
    assert.ok(Math.min(...sizes(filled.svg)) > Math.min(...sizes(plain.svg)), 'every size, the table cells included, is scaled');
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, {recursive: true});
  }
});
