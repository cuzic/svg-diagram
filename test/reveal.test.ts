import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {banner, bars, box, build, checkDiagram, closeMeasurer, connect, diagram, group, plane, renderDiagram, row, table} from '../lib/dsl.ts';
import {emitSvg} from '../lib/emit.ts';
import {imgSelector} from '../lib/slide-budget.ts';

test.after(() => closeMeasurer());

const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = (prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const canvas = (svg: string) => svg.match(/viewBox="[^"]+"/)?.[0];
const stage = (svg: string) => JSON.parse(svg.match(/<metadata id="svg-diagram">(.*?)<\/metadata>/)![1].replace(/&quot;/g, '"')).reveal;
const SOURCE = {generator: 'svg-diagram', toolVersion: 'test', source: 'x.ts', sourceSha256: 'x'};

function staged() {
  const a = box({id: 'a', title: 'always'});
  const b = box({id: 'b', title: 'one', reveal: 1});
  return diagram({theme: 'blue', title: 't'}).add(
    row([a, b], {id: 'r'}), connect(a.right, b.left),
    banner({headline: 'two', reveal: 2}),
    table([{label: 'x'}], [['table']], {reveal: 2}),
    plane({x: {max: 1}, y: {max: 1}, reveal: 3}),
  );
}

test('stages are cumulative and keep one layout and canvas', async () => {
  const d = staged();
  d.source = SOURCE;
  const {laidOut} = await checkDiagram(d);
  assert.equal(laidOut.connects[0].reveal, 1);
  assert.equal(laidOut.maxReveal, 3);
  const stages = [0, 1, 2, 3].map(n => emitSvg(laidOut, {reveal: n}));
  assert.match(stages[0], />always</);
  assert.doesNotMatch(stages[0], />one</);
  assert.doesNotMatch(stages[0], /dsl-arrow\)/);
  assert.match(stages[1], />one</);
  assert.doesNotMatch(stages[1], />two</);
  assert.match(stages[2], />two</);
  assert.match(stages[2], />table</);
  const lens = stages.map(s => s.length);
  assert.deepEqual(lens, [...lens].sort((x, y) => x - y), 'each stage adds to the one before');
  assert.equal(new Set(stages.map(canvas)).size, 1);
  assert.deepEqual(stages.map(stage), [0, 1, 2, 3]);
  // the file without a stage is the final form
  const rendered = await renderDiagram(staged(), {name: 'x.svg', budget: 'cacheOnly'});
  assert.equal(rendered.svg.match(/<rect/g)?.length, stages[3].match(/<rect/g)?.length);
});

test('group children take max(parent, own); a connect to row#N follows that column; an early arrow warns', async () => {
  const d = diagram({theme: 'blue'}).add(
    group([box({id: 'child', title: 'child', reveal: 1}), box({id: 'late', title: 'late', reveal: 5})], {reveal: 2}),
    row([box({title: 'first'}), box({title: 'second', reveal: 3})], {id: 'r'}),
    connect('child:right', 'r#2:left', {reveal: 1}),
    connect('child:bottom', 'r#1:top'),
    bars([{id: 'bar', label: 'bar', value: 1, reveal: 4}], {max: 1}),
  );
  const {laidOut, verdict} = await checkDiagram(d);
  const reveal = (id: string) => { const b = laidOut.laidOut.find(x => x.type === 'box' && x.id === id); return b?.type === 'box' ? b.reveal : undefined; };
  assert.equal(reveal('child'), 2);
  assert.equal(reveal('late'), 5);
  assert.equal(laidOut.connects[0].reveal, 1);
  assert.match(verdict.warnings.join('\n'), /earlier than an endpoint.*reveal 3/);
  assert.equal(laidOut.connects[1].reveal, 2, 'default is the max of both ends');
  assert.equal(laidOut.laidOut.find(x => x.type === 'bars')?.bars[0].reveal, 4);
});

test('reveal is a positive 1-based integer', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(box({title: 'bad', reveal: 0}))), /whole number >= 1/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(box({title: 'bad', reveal: 1.5}))), /whole number >= 1/);
});

test('build writes name.revealN.svg only for a revealing diagram and removes stale stages', async () => {
  const dir = tmp('svg-diagram-reveal-');
  const out = path.join(dir, 'figure.svg');
  const first = await build(diagram({theme: 'blue'}).add(box({title: 'later', reveal: 3})), out, {lint: false});
  assert.equal(first.revealPaths.length, 4);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['figure.reveal0.svg', 'figure.reveal1.svg', 'figure.reveal2.svg', 'figure.reveal3.svg', 'figure.svg']);
  const sizes = new Set(fs.readdirSync(dir).map(f => canvas(fs.readFileSync(path.join(dir, f), 'utf8'))));
  assert.equal(sizes.size, 1);
  await build(diagram({theme: 'blue'}).add(box({title: 'sooner', reveal: 1})), out, {lint: false});
  assert.deepEqual(fs.readdirSync(dir).sort(), ['figure.reveal0.svg', 'figure.reveal1.svg', 'figure.svg']);
  const plain = await build(diagram({theme: 'blue'}).add(box({title: 'plain'})), out, {lint: false});
  assert.equal(plain.revealPaths.length, 0);
  assert.deepEqual(fs.readdirSync(dir), ['figure.svg']);
});

test('a diagram without reveal is emitted exactly as before', async () => {
  const d = () => diagram({theme: 'blue', title: 't'}).add(row([box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'})]), connect('a:right', 'b:left'));
  const dir = tmp('svg-diagram-plain-');
  const built = await build(d(), path.join(dir, 'p.svg'), {lint: false});
  assert.equal(built.revealPaths.length, 0);
  const rendered = await renderDiagram(d(), {name: 'p.svg', budget: 'cacheOnly'});
  assert.equal(fs.readFileSync(path.join(dir, 'p.svg'), 'utf8'), rendered.svg);
  assert.doesNotMatch(rendered.svg, /reveal/);
});

test('check --drift compares every stage and reports a leftover one; the orphan check skips stages', () => {
  const dir = tmp('svg-diagram-drift-');
  const src = path.join(dir, 'fig.ts');
  const write = (reveal: number) => fs.writeFileSync(src, `import {diagram, box} from 'svg-diagram';
export default () => diagram({theme: 'blue', title: 't'}).add(box({title: 'a'}), box({title: 'b', reveal: ${reveal}}));
`);
  const run = (script: string, ...args: string[]) => spawnSync(process.execPath, [path.join(ROOT, script), ...args], {cwd: dir, encoding: 'utf8'});
  const text = (r: ReturnType<typeof run>) => `${r.stdout}\n${r.stderr}`;
  write(2);
  const b = run('build-diagram.ts', '--out-dir', 'svg', 'fig.ts');
  assert.equal(b.status, 0, text(b));
  assert.equal(fs.existsSync(path.join(dir, 'svg', 'fig.reveal2.svg')), true);
  const ok = run('check-diagram.ts', '--drift', '--rebuild', '--svg-dir', 'svg', 'fig.ts');
  assert.equal(ok.status, 0, text(ok));
  fs.appendFileSync(path.join(dir, 'svg', 'fig.reveal1.svg'), '<!-- edited -->\n');
  const edited = run('check-diagram.ts', '--drift', '--rebuild', '--svg-dir', 'svg', 'fig.ts');
  assert.equal(edited.status, 1, text(edited));
  assert.match(text(edited), /fig\.reveal1\.svg/);
  run('build-diagram.ts', '--out-dir', 'svg', 'fig.ts');
  fs.writeFileSync(path.join(dir, 'svg', 'fig.reveal5.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const orphan = run('check-diagram.ts', '--drift', '--rebuild', '--svg-dir', 'svg', 'fig.ts');
  assert.equal(orphan.status, 1, text(orphan));
  assert.match(text(orphan), /fig\.reveal5\.svg/);
  fs.rmSync(path.join(dir, 'svg', 'fig.reveal5.svg'));
  fs.writeFileSync(path.join(dir, 'doc.md'), '![](svg/fig.svg)\n');
  const docs = run('check-diagram.ts', '--docs', '.', '--svg-dir', 'svg');
  assert.doesNotMatch(text(docs), /doc-orphan-svg/);
});

test('slide-budget selector accepts name.svg and name.revealN.svg', () => {
  const sel = imgSelector('.s', 'flow.svg');
  assert.match(sel, /img\[src\$="\/svg\/flow\.svg"\]/);
  assert.match(sel, /img\[src\*="\/svg\/flow\.reveal"\]\[src\$="\.svg"\]/);
});

test('bars inside a later group hide their axis too, and the bars band alone keeps its axis', async () => {
  const mk = (inGroup: boolean) => {
    const b = bars([{label: 'v', value: 1, reveal: 1}], {max: 1});
    return diagram({theme: 'blue'}).add(box({title: 'x'}), inGroup ? group([b], {reveal: 2}) : b);
  };
  const lines = (svg: string) => svg.match(/stroke="#[0-9a-f]+" stroke-width="2"\/>/g)?.length ?? 0;
  const grouped = (await checkDiagram(mk(true))).laidOut, alone = (await checkDiagram(mk(false))).laidOut;
  assert.equal(lines(emitSvg(grouped, {reveal: 0})), 0);
  assert.ok(lines(emitSvg(grouped, {reveal: 2})) > 0);
  assert.ok(lines(emitSvg(alone, {reveal: 0})) > 0);
});
