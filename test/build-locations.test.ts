import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {assertBuildOutput} from '../lib/build-verdict.ts';
import {layoutFinding} from '../lib/layout-issues.ts';
import {SourceRef} from '../lib/source-ref.ts';
import {box, build, closeMeasurer, diagram} from '../lib/dsl.ts';
import type {locationsMap} from '../lib/locations-map.ts';

const root = path.resolve(import.meta.dirname, '..');
const source = `import {box, connect, diagram, row} from 'svg-diagram';
const first = () => box({id: 'a', title: 'First', padY: 17.5});
export default () => diagram({theme: 'blue', gap: 80}).add(
  row([
    first(),
    box({id: 'b', title: 'Second', padY: 17.5, reveal: 1}),
  ]),
  connect('a:right', 'b:left', {label: 'Next'}),
);
`;
const overlap = `import {box, diagram, spacer} from 'svg-diagram';
export default () => diagram({theme: 'blue'}).add(
  box({title: 'First'}),
  spacer(-40),
  box({title: 'Second'}),
);
`;

function fixture(t: TestContext, files: Record<string, string>) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-build-locations-'));
  t.after(() => fs.rmSync(cwd, {recursive: true, force: true}));
  const write = (file: string, value: string) => fs.writeFileSync(path.join(cwd, file), value);
  for (const [file, value] of Object.entries(files)) write(file, value);
  const run = (cli: string, args: string[], nodeArgs: string[] = []) => spawnSync(process.execPath, [...nodeArgs, path.join(root, `${cli}-diagram.ts`), ...args], {cwd, encoding: 'utf8'});
  const read = (file: string) => fs.readFileSync(path.join(cwd, file), 'utf8');
  const exists = (file: string) => fs.existsSync(path.join(cwd, file));
  return {cwd, write, read, exists, run, build: (...args: string[]) => run('build', ['--no-lint', ...args])};
}

function assertStatus(result: ReturnType<ReturnType<typeof fixture>['build']>, expected: number) {
  assert.equal(result.status, expected, result.stdout + result.stderr);
}

test('build --locations maps rows, boxes and connections in layout order', t => {
  const p = fixture(t, {'figure.ts': source});
  const plain = p.build('figure.ts');
  assertStatus(plain, 0);
  const svg = p.read('svg/figure.svg');
  const result = p.build('figure.ts', '--locations', 'maps/figure.json');
  assertStatus(result, 0);
  assert.equal(result.stdout, plain.stdout);
  assert.equal(p.read('svg/figure.svg'), svg);
  const map = JSON.parse(p.read('maps/figure.json')) as ReturnType<typeof locationsMap>;
  assert.equal(map.version, 1);
  assert.equal(map.source, 'figure.ts');
  assert.ok(svg.includes(`viewBox="0 0 ${map.width} ${map.height}"`));
  assert.deepEqual(map.diagram.loc, {file: 'figure.ts', line: 3, column: 22});
  assert.deepEqual(map.parts.map(part => part.kind), ['row', 'box', 'box']);
  const [, first, second] = map.parts;
  assert.ok(first && second);
  assert.equal(first.label, 'First');
  assert.equal(first.node, 'a');
  assert.deepEqual(first.loc, {file: 'figure.ts', line: 2, column: 21});
  assert.deepEqual(first.via, [{line: 5, column: 5}]);
  assert.deepEqual(second.loc, {file: 'figure.ts', line: 6, column: 5});
  assert.equal(second.reveal, 1);

  const rects = [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" rx="8"/g)].map(([, x, y, w, h]) => ({x: Number(x), y: Number(y), w: Number(w), h: Number(h)}));
  assert.deepEqual([first.rect, second.rect], rects);
  assert.equal(map.connects.length, 1);
  const [line] = map.connects;
  assert.ok(line);
  assert.equal(line.kind, 'connect');
  assert.equal(line.label, 'Next');
  assert.deepEqual(line.loc, {file: 'figure.ts', line: 8, column: 3});
  const route = /<path d="M(\d+),(\d+) L(\d+),(\d+)" fill="none"[^>]*marker-end=/.exec(svg);
  assert.ok(route);
  assert.deepEqual(line.segments, [route.slice(1).map(Number)]);
  const [, labelY] = /<text x="[^"]+" y="(\d+)" text-anchor="middle"[^>]*>Next<\/text>/.exec(svg) ?? [];
  assert.ok(labelY && line.rect.y < Number(labelY) && line.rect.y + line.rect.h > Number(labelY));
  assert.equal(line.reveal, 1);
  assert.equal(map.issues, undefined);
});

test('build --locations writes layout issues and removes the old map on loading errors', t => {
  const p = fixture(t, {'figure.ts': overlap});
  const result = p.build('figure.ts', '--locations', 'figure.json');
  assertStatus(result, 1);
  assert.match(result.stderr, /layout verification failed/);
  assert.ok(!p.exists('svg/figure.svg'));
  const map = JSON.parse(p.read('figure.json'));
  const checked = p.run('check', ['--format', 'json', 'figure.ts']);
  assertStatus(checked, 1);
  assert.deepEqual(map.issues, JSON.parse(checked.stdout).findings);
  assert.match(map.issues[0].message, /"First" overlaps "Second"/);
  assert.equal(map.issues[0].line, 3);
  assert.equal(map.issues[0].related[0].line, 5);

  p.write('figure.ts', 'export default () => { throw new Error("define failed"); };');
  const thrown = p.build('figure.ts', '--locations', 'figure.json');
  assertStatus(thrown, 1);
  assert.match(thrown.stderr, /define failed/);
  assert.ok(!p.exists('figure.json'));

  p.write('figure.json', '{}');
  p.write('figure.ts', 'export default (;');
  assertStatus(p.build('figure.ts', '--locations', 'figure.json'), 1);
  assert.ok(!p.exists('figure.json'));
});

test('build --locations accepts one source and --locations-dir names each map', t => {
  const p = fixture(t, {'first.ts': source, 'second.ts': source});
  const result = p.build('first.ts', 'second.ts', '--locations', 'figure.json');
  assertStatus(result, 2);
  assert.match(result.stderr, /--locations-dir/);
  assert.ok(!p.exists('figure.json'));
  assertStatus(p.build('first.ts', path.join(p.cwd, 'second.ts'), '--locations-dir', 'maps'), 0);
  for (const file of ['first', 'second']) {
    const map = JSON.parse(p.read(`maps/${file}.locations.json`));
    assert.equal(map.source, `${file}.ts`);
    assert.equal(map.parts[1].loc.file, `${file}.ts`);
  }
});

test('build --stale backfills a missing map without rewriting the current SVG', t => {
  const p = fixture(t, {'figure.ts': source});
  assertStatus(p.build('figure.ts'), 0);
  const svg = path.join(p.cwd, 'svg/figure.svg');
  fs.utimesSync(svg, 100, 100);
  const result = p.build('figure.ts', '--stale', '--locations', 'figure.json');
  assertStatus(result, 0);
  assert.match(result.stdout, /最新（スキップ）/);
  assert.equal(fs.statSync(svg).mtimeMs, 100_000);
  const map = JSON.parse(p.read('figure.json'));
  assert.equal(map.parts[1].label, 'First');
});

test('build result exposes layout as a non-enumerable field', async t => {
  const p = fixture(t, {});
  t.after(() => closeMeasurer());
  const result = await build(diagram({theme: 'blue'}).add(box({title: 'First'})), path.join(p.cwd, 'first.svg'), {lint: false});
  assert.equal(Object.getOwnPropertyDescriptor(result, 'laidOut')?.enumerable, false);
  assert.equal(result.laidOut.laidOut[0]?.type, 'box');
  assert.equal(result.laidOut.canvasHeight, result.height);
  assert.throws(() => assertBuildOutput({
    verdict: {ok: true, problems: [], warnings: [], findings: []}, laidOut: result.laidOut, xml: ['malformed'],
  }, result.outPath), (err: Error & {laidOut?: typeof result.laidOut}) => {
    assert.match(err.message, /not well-formed XML/);
    assert.equal(err.laidOut, result.laidOut);
    assert.equal(Object.getOwnPropertyDescriptor(err, 'laidOut')?.enumerable, false);
    return true;
  });
});

test('check and build --locations report the problems of a legacy Verdict', t => {
  const p = fixture(t, {'figure.ts': overlap});
  const verify = new URL('../lib/verify.ts', import.meta.url).href;
  // Feed both command paths the same legacy verifier output, with only the text of each problem.
  p.write('legacy.mjs', `import {registerHooks} from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    const resolved = next(specifier, context);
    if (resolved.url !== ${JSON.stringify(verify)}) return resolved;
    return {url: new URL('./legacy-verify.mjs', import.meta.url).href, shortCircuit: true};
  }
});
`);
  p.write('legacy-verify.mjs', `import {verifyDiagram as verify} from ${JSON.stringify(verify + '?legacy-fixture')};
export function verifyDiagram(diagram) {
  const {issues, ...verdict} = verify(diagram);
  return verdict;
}
`);
  const preload = ['--import', path.join(p.cwd, 'legacy.mjs')];
  const checked = p.run('check', ['--format', 'json', 'figure.ts'], preload);
  assertStatus(checked, 1);
  const {findings} = JSON.parse(checked.stdout);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /"First" overlaps "Second"/);
  assert.deepEqual(findings[0], {file: 'figure.ts', rule: 'layout', severity: 'error', message: findings[0].message});

  const result = p.run('build', ['--no-lint', 'figure.ts', '--locations', 'figure.json'], preload);
  assertStatus(result, 1);
  assert.deepEqual(JSON.parse(p.read('figure.json')).issues, findings);
});

test('layoutFinding uses the location field when the part comes from another source', () => {
  const loc = new SourceRef({});
  const position = {file: 'shared.ts', line: 2, column: 3};
  const finding = layoutFinding('figure.ts', {message: 'overlap', loc}, ref => ({loc: ref === loc ? position : undefined, via: []}));
  assert.deepEqual(finding, {file: 'figure.ts', rule: 'layout', severity: 'error', message: 'overlap', location: position});
});
