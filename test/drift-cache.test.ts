// ADR 0038: `check --drift --rebuild` runs the sources in parallel and keeps a cache of passes. The cache may only say "no drift" when every
// input of the rebuild is the same; the output is the same in any order of finishing, with or without the cache.
// Pure parts first, then the CLI in a scratch project. Nothing here depends on a font: only on a pass / a drift, and on the order of the lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {driftKey, entryHolds, makeEntry, parseEntry, type DriftKeyParts} from '../lib/drift-cache.ts';
import {makePng} from './helpers/png.ts';

const parts = (over: Partial<DriftKeyParts> = {}): DriftKeyParts => ({tool: 't', fonts: 'f', config: '{}', source: '/p/a.ts', sourceSha256: 's', depsSha256: 'd', committed: {'a.svg': 'x'}, provenance: '{}', ...over});

test('driftKey: every part of the input changes the key; the order of the committed files does not', () => {
  const base = driftKey(parts());
  for (const over of [{tool: 't2'}, {fonts: 'f2'}, {config: '{"a":1}'}, {source: '/p/b.ts'}, {sourceSha256: 's2'}, {depsSha256: 'd2'}, {committed: {'a.svg': 'y'}}, {committed: {"a.svg": "x", "a.reveal0.svg": "z"}}, {provenance: "{\"v\":2}"}] as Partial<DriftKeyParts>[])
    assert.notEqual(driftKey(parts(over)), base, JSON.stringify(over));
  assert.equal(driftKey(parts({committed: {'a.svg': 'x', 'b.svg': 'y'}})), driftKey(parts({committed: {'b.svg': 'y', 'a.svg': 'x'}})));
});

test('entryHolds: only when the key matches and every file the build read, and every path it asked about, is as it was', () => {
  const key = driftKey(parts());
  const entry = makeEntry(key, [{path: '/img.png', sha256: 'aa'}, {path: '/gone.png', sha256: null}], [{path: '/icons.json', exists: false}]);
  const world = {hashOf: (p: string) => (p === '/img.png' ? 'aa' : null), exists: (_p: string) => false};
  assert.equal(entryHolds(entry, key, world), true);
  assert.equal(entryHolds(entry, 'other', world), false, 'another key');
  assert.equal(entryHolds(entry, key, {...world, hashOf: (p: string) => (p === '/img.png' ? 'bb' : null)}), false, 'an image changed');
  assert.equal(entryHolds(entry, key, {...world, hashOf: (p: string) => (p === '/gone.png' ? 'cc' : p === '/img.png' ? 'aa' : null)}), false, 'a missing file appeared');
  assert.equal(entryHolds(entry, key, {...world, exists: (p: string) => p === '/icons.json'}), false, 'an icon manifest appeared');
  assert.equal(entryHolds(null, key, world), false);
  assert.equal(parseEntry('{not json'), null);
  assert.equal(parseEntry(JSON.stringify({...entry, version: 0})), null, 'an entry of another format is no entry');
  assert.deepEqual(parseEntry(JSON.stringify(entry)), entry);
});

// ---- the CLI ----------------------------------------------------------------------------------------------------------------
const ROOT = path.resolve(import.meta.dirname, '..');
const cli = (script: string, cwd: string, ...args: string[]) => spawnSync(process.execPath, [path.join(ROOT, script), ...args], {cwd, encoding: 'utf8'});
const text = (r: ReturnType<typeof cli>) => `${r.stdout}\n${r.stderr}`;
const box = (title: string) => `import {diagram, box, row} from 'svg-diagram';
export default () => diagram({theme: 'blue', title: '試験図'}).add(row([box({id: 'a', title: ${JSON.stringify(title)}, tone: 'accent'}), box({id: 'b', title: '出口'})]));
`;
const IMG = `import {diagram, image} from 'svg-diagram';
export default () => diagram({theme: 'blue', title: '絵'}).add(image('./pic.png', {id: 'pic', alt: '試験の絵', width: 240}));
`;

function project(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-cache-'));
  fs.mkdirSync(path.join(dir, 'src'));
  for (const [n, t] of [['a', '入口'], ['b', '受付'], ['c', '確認'], ['d', '完了']] as const) fs.writeFileSync(path.join(dir, 'src', `${n}.ts`), box(t));
  fs.writeFileSync(path.join(dir, 'src', 'pic.png'), makePng(40, 30));
  fs.writeFileSync(path.join(dir, 'src', 'img.ts'), IMG);
  const built = cli('build-diagram.ts', dir, '--no-lint', 'src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/img.ts');
  assert.equal(built.status, 0, text(built));
  return dir;
}
const ALL = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/img.ts'];
const check = (dir: string, ...extra: string[]) => cli('check-diagram.ts', dir, '--drift', '--rebuild', ...extra, ...ALL);

test('check --drift --rebuild: parallel, cached and uncached runs print exactly the same, in the order of the arguments', () => {
  const dir = project();
  const serial = check(dir, '--jobs', '1', '--no-cache');
  assert.equal(serial.status, 0, text(serial));
  assert.equal(fs.existsSync(path.join(dir, '.svg-diagram-cache')), false, '--no-cache writes nothing');
  const cold = check(dir, '--jobs', '3');
  assert.equal(cold.status, 0, text(cold));
  assert.ok(fs.readdirSync(path.join(dir, '.svg-diagram-cache')).filter(f => f.endsWith('.json')).length >= ALL.length, 'every pass is kept');
  assert.ok(fs.existsSync(path.join(dir, '.svg-diagram-cache', '.gitignore')), 'the cache directory ignores itself');
  const warm = check(dir, '--jobs', '3');
  const warmSerial = check(dir, '--jobs', '1');
  for (const r of [cold, warm, warmSerial]) { assert.equal(r.stdout, serial.stdout); assert.equal(r.stderr, serial.stderr); }
  assert.deepEqual(serial.stdout.trim().split('\n').map(l => /(src\/\w+\.ts)/.exec(l)?.[1]), ALL);
});

test('check --drift --rebuild: a cached pass never hides a drift (hand-edited SVG, changed picture, changed config)', () => {
  const dir = project();
  assert.equal(check(dir, '--jobs', '2').status, 0);
  assert.equal(check(dir, '--jobs', '2').status, 0, 'warm');
  // 1. the committed SVG is edited by hand
  const svgFile = path.join(dir, 'svg', 'b.svg');
  const good = fs.readFileSync(svgFile, 'utf8');
  fs.writeFileSync(svgFile, good.replace('</svg>', '<rect x="1" y="1" width="3" height="3" fill="#f00"/></svg>'));
  let r = check(dir, '--jobs', '2');
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /src\/b\.ts/);
  assert.match(r.stderr, /一致しない/);
  assert.match(text(check(dir, '--jobs', '1')), /src\/b\.ts/, 'the same serially');
  fs.writeFileSync(svgFile, good);
  assert.equal(check(dir).status, 0, 'and passes again once restored');
  // 2. the picture a figure embeds changes (nothing about the source changes)
  fs.writeFileSync(path.join(dir, 'src', 'pic.png'), makePng(40, 30, (x, y) => [y * 8, x * 6, 0]));
  r = check(dir, '--jobs', '2');
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /src\/img\.ts/);
  assert.doesNotMatch(r.stderr, /src\/a\.ts/);
  // 3. the project settings change (a tone colour here: any change of the resolved config is a different build)
  fs.writeFileSync(path.join(dir, 'src', 'pic.png'), makePng(40, 30));
  assert.equal(check(dir, '--jobs', '2').status, 0);
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({tones: {accent: {fill: '#e6d3bd'}}}));
  r = check(dir, '--jobs', '2');
  assert.equal(r.status, 1, text(r)); // the committed SVGs were built without it: they must not be answered from the old pass
});

test('check --drift --rebuild --jobs: a bad value is a usage error', () => {
  const r = cli('check-diagram.ts', os.tmpdir(), '--drift', '--jobs', '0', 'x.ts');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--jobs/);
});
