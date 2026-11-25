import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {assertBuildOutput} from '../lib/build-verdict.ts';
import {frameGeometry} from '../lib/emit-box-frame.ts';
import {ganttBarGeometry} from '../lib/emit-gantt.ts';
import {primRectGeometry} from '../lib/emit-wireframe.ts';
import {readProvenance} from '../lib/freshness.ts';
import {layoutFinding} from '../lib/layout-issues.ts';
import {SourceRef} from '../lib/source-ref.ts';
import {box, build, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {loadDiagram} from '../lib/load-source.ts';
import type {locationsMap} from '../lib/locations-map.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';

const root = path.resolve(import.meta.dirname, '..');
const source = `import {box, connect, diagram, row} from 'svg-diagram';
const first = () => box({id: 'a', title: 'First'});
export default () => diagram({theme: 'blue', gap: 80}).add(
  row([
    first(),
    box({id: 'b', title: 'Second', reveal: 1}),
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
  const write = (file: string, value: string) => {
    const target = path.join(cwd, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, value);
  };
  for (const [file, value] of Object.entries(files)) write(file, value);
  const run = (cli: string, args: string[], nodeArgs: string[] = []) => spawnSync(process.execPath, [...nodeArgs, path.join(root, `${cli}-diagram.ts`), ...args], {cwd, encoding: 'utf8'});
  const read = (file: string) => fs.readFileSync(path.join(cwd, file), 'utf8');
  const exists = (file: string) => fs.existsSync(path.join(cwd, file));
  return {cwd, write, read, exists, run, build: (...args: string[]) => run('build', ['--no-lint', ...args])};
}

function assertStatus(result: ReturnType<ReturnType<typeof fixture>['build']>, expected: number) {
  assert.equal(result.status, expected, result.stdout + result.stderr);
}

function readMap(p: ReturnType<typeof fixture>, file = 'figure.json'): ReturnType<typeof locationsMap> {
  return JSON.parse(p.read(file));
}

function svgFrames(svg: string, radius = 8) {
  return [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" rx="(\d+)"/g)]
    .filter(match => Number(match[5]) === radius)
    .map(([, x, y, w, h]) => ({x: Number(x), y: Number(y), w: Number(w), h: Number(h)}));
}

test('frame, gantt bar and primitive geometry use their respective SVG snapping rules', () => {
  const rect = {x: 3, y: 3, w: 6, h: 6};
  assert.deepEqual(frameGeometry(rect), {x: 4, y: 4, w: 4, h: 8});
  assert.deepEqual(ganttBarGeometry(rect), {x: 4, y: 4, w: 8, h: 6});
  assert.deepEqual(primRectGeometry(rect), {x: 4, y: 4, w: 4, h: 4});
});

test('build --locations maps rows, boxes and connections in layout order', t => {
  const p = fixture(t, {'figure.ts': source});
  const plain = p.build('figure.ts');
  assertStatus(plain, 0);
  const svg = p.read('svg/figure.svg');
  const result = p.build('figure.ts', '--locations', 'figure.json');
  assertStatus(result, 0);
  assert.equal(result.stdout, plain.stdout);
  assert.equal(p.read('svg/figure.svg'), svg);
  const map = readMap(p);
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

  assert.deepEqual([first.rect, second.rect], svgFrames(svg));
  assert.equal(map.connects.length, 1);
  const [line] = map.connects;
  assert.ok(line);
  assert.equal(line.kind, 'connect');
  assert.equal(line.label, 'Next');
  assert.deepEqual(line.loc, {file: 'figure.ts', line: 8, column: 3});
  const route = /<path d="M(\d+),(\d+) L(\d+),(\d+)" fill="none"[^>]*marker-end=/.exec(svg);
  assert.ok(route);
  assert.deepEqual(line.segments.map(segment => segment.map(Math.round)), [route.slice(1).map(Number)]);
  const [, labelY] = /<text x="[^"]+" y="(\d+)" text-anchor="middle"[^>]*>Next<\/text>/.exec(svg) ?? [];
  assert.ok(labelY && line.rect.y < Number(labelY) && line.rect.y + line.rect.h > Number(labelY));
  assert.equal(line.reveal, 1);
  assert.equal(map.issues, undefined);
});

test('build --locations matches box and group frames to their SVG rectangles', t => {
  const p = fixture(t, {
    'figure.ts': fs.readFileSync(path.join(root, 'examples/slide-canvas.ts'), 'utf8'),
    'cloud.ts': fs.readFileSync(path.join(root, 'examples/cloud-architecture.ts'), 'utf8'),
    'svg-diagram.icons.json': fs.readFileSync(path.join(root, 'svg-diagram.icons.json'), 'utf8'),
  });
  assertStatus(p.build('figure.ts', '--locations', 'figure.json'), 0);
  const rects = svgFrames(p.read('svg/figure.svg'));
  assert.equal(rects.length, 3);
  assert.deepEqual(readMap(p).parts.filter(part => part.kind === 'box').map(part => part.rect), rects);

  assertStatus(p.build('cloud.ts', '--locations', 'cloud.json'), 0);
  const frames = svgFrames(p.read('svg/cloud.svg'));
  const groups = readMap(p, 'cloud.json').parts.filter(part => part.kind === 'group');
  assert.ok(groups.length);
  assert.deepEqual(groups[0]?.rect, frames[0]);
});

function exampleFixture(t: TestContext, name: string) {
  const p = fixture(t, {'figure.ts': fs.readFileSync(path.join(root, 'examples', name + '.ts'), 'utf8')});
  assertStatus(p.build('figure.ts', '--locations', 'figure.json'), 0);
  return p;
}

test('build --locations uses the frame geometry of tree and banner parts', async t => {
  for (const [name, kind] of [['mindmap', 'tree'], ['text-roles', 'banner']] as const) {
    await t.test(kind, t => {
      const p = exampleFixture(t, name);
      const parts = readMap(p).parts.filter(part => part.kind === kind).slice(kind === 'tree' ? 1 : 0);
      const frames = svgFrames(p.read('svg/figure.svg'));
      assert.ok(parts.length);
      assert.deepEqual(parts.map(part => part.rect), frames);
    });
  }
});

test('build --locations uses frames for cause, states and bpmn nodes that draw them', async t => {
  installResolveHook();
  t.after(closeMeasurer);
  for (const [name, kind] of [['toc-prt', 'cause'], ['qc-arrow', 'states'], ['bpmn', 'bpmn']] as const) {
    await t.test(kind, async t => {
      const p = exampleFixture(t, name);
      const {laidOut} = await checkDiagram(await loadDiagram(path.join(p.cwd, 'figure.ts'), {}));
      const band = laidOut.laidOut.find(band => band.type === kind);
      assert.ok(band && 'nodes' in band);
      const parts = readMap(p).parts.filter(part => part.kind === kind && part.node);
      const frames = svgFrames(p.read('svg/figure.svg'));
      assert.equal(parts.length, band.nodes.length);
      let unframed = 0;
      for (const [i, node] of band.nodes.entries()) {
        const part = parts[i];
        assert.ok(part?.node);
        if (('hex' in node && node.hex) || ('circle' in node && node.circle) || ('kind' in node && node.kind !== 'task')) {
          const {x, y, w, h} = node;
          assert.deepEqual(part.rect, {x, y, w, h}, part.node);
          unframed++;
        } else {
          assert.ok(frames.some(frame => isDeepStrictEqual(frame, part.rect)), part.node);
        }
      }
      assert.ok(unframed);
    });
  }
});

test('build --locations matches gantt bars to their SVG rectangles', t => {
  const p = exampleFixture(t, 'gantt');
  const frames = svgFrames(p.read('svg/figure.svg'), 4);
  const parts = readMap(p).parts.filter(part => part.kind === 'gantt' && part.node);
  assert.deepEqual(parts.map(part => part.node), ['req', 'ui', 'app', 'api', 'test']);
  // The first two bars also draw a progress overlay after their outer rect.
  assert.deepEqual(parts.map(part => part.rect), frames.filter((_, index) => index !== 1 && index !== 3));
});

test('build --locations matches screens items to their SVG rectangles', async t => {
  for (const [name, radius, count] of [['inventory-component-spec', 8, 9], ['inventory-flow', 4, 4]] as const) {
    await t.test(name, t => {
      const p = exampleFixture(t, name);
      const parts = readMap(p).parts.filter(part => part.kind === 'screens').slice(1);
      const frames = svgFrames(p.read('svg/figure.svg'), radius);
      assert.equal(parts.length, count);
      for (const part of parts) {
        assert.ok(frames.some(frame => isDeepStrictEqual(frame, part.rect)), JSON.stringify(part));
      }
    });
  }
});

test('build captures part sources only with a locations flag', t => {
  const p = fixture(t, {'probe.ts': `import {box, diagram} from 'svg-diagram';
export default () => {
  const part = box({title: 'Capture probe'});
  console.log('SOURCE capture: ' + (Object.hasOwn(part, Symbol.for('svg-diagram.source')) ? 'on' : 'off'));
  return diagram({theme: 'blue'}).add(part);
};
`});
  for (const [capture, args] of [['off', []], ['on', ['--locations', 'figure.json']], ['on', ['--locations-dir', 'maps']]] as const) {
    const result = p.build('probe.ts', ...args);
    assertStatus(result, 0);
    assert.match(result.stdout, new RegExp(`^SOURCE capture: ${capture}$`, 'm'));
  }
});

test('build --locations keeps item lifetimes, grid height, scoped row names, and cause node names', t => {
  const p = fixture(t, {'figure.ts': `import {bars, box, connect, diagram, grid, row, whyWhyTree} from 'svg-diagram';
export default () => diagram({theme: 'blue'}).add(
  box({id: 'standalone', title: 'Standalone'}),
  row([Object.assign(box({id: 'gate', title: 'Gate', until: 3}), {scope: 'plan'}), box({id: 'next', title: 'Next'})], {gap: 80}),
  connect('gate:right', 'next:left', {until: 3}),
  grid([box({title: 'Grid first'}), box({title: 'Grid second'})], {cols: 1}),
  bars([{id: 'temporary', label: 'Temporary', value: 25, reveal: 1, until: 2}, {label: 'Current', value: 45, reveal: 2}], {max: 100}),
  whyWhyTree('Delayed', [{id: 'known', why: 'No time'}, {why: 'No plan'}], {scope: 'reason', readingNote: false}),
);
`});
  assertStatus(p.build('figure.ts', '--locations', 'figure.json'), 0);
  const {parts, connects} = readMap(p);
  assert.equal(parts.filter(part => part.node === 'standalone').length, 1);
  const gate = parts.find(part => part.label === 'Gate');
  assert.ok(gate);
  assert.deepEqual([gate.node, gate.until, gate.final], ['plan.gate', 3, false]);
  assert.equal(parts.find(part => part.label === 'Next')?.final, undefined);
  assert.equal(connects.length, 1);
  assert.equal(connects[0]?.final, false);
  const temporary = parts.find(part => part.node === 'temporary');
  assert.ok(temporary);
  assert.deepEqual([temporary.reveal, temporary.until, temporary.final], [1, 2, false]);
  assert.doesNotMatch(p.read('svg/figure.svg'), />Gate<|>Temporary</);
  assert.match(p.read('svg/figure.reveal1.svg'), />Temporary</);

  const grid = parts.find(part => part.kind === 'grid');
  const last = parts.find(part => part.label === 'Grid second');
  assert.ok(grid && last);
  assert.ok(Math.abs(grid.rect.y + grid.rect.h - last.rect.y - last.rect.h) <= 4);
  const cause = parts.filter(part => part.kind === 'cause');
  assert.equal(cause.length, 4); // the figure, its effect, and two causes
  assert.deepEqual(cause.flatMap(part => part.node ?? []), ['reason.known']);
});

test('build --locations marks group titles and areas wrappers as generated', t => {
  const p = fixture(t, {'figure.ts': `import {areas, box, caption, diagram, group, row} from 'svg-diagram';
export default () => diagram({theme: 'blue'}).add(
  group([box({title: 'Member'})], {id: 'own', title: 'Own title'}),
  areas('memo note author', {memo: box({title: 'Memo'}), note: caption('Note'), author: group([caption('Author')], {frame: false})}),
  row([box({title: 'An ordinary cell'})], {id: 'ordinary'}),
);
`});
  assertStatus(p.build('figure.ts', '--locations', 'figure.json'), 0);
  const {parts} = readMap(p);
  assert.deepEqual(parts.filter(part => part.generated).map(({kind, node, loc}) => [kind, node, loc.line]), [
    ['caption', undefined, 3], ['caption', undefined, 3], ['row', undefined, 4], ['group', 'note', 4],
  ]);
  assert.deepEqual(parts.filter(part => part.node === 'author').map(part => part.generated), [undefined]);
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
    assert.equal(map.source, `../${file}.ts`);
    assert.equal(map.parts[1].loc.file, `../${file}.ts`);
  }
});

test('build --locations bases source and location paths on the map directory', t => {
  const p = fixture(t, {
    'src/figure.ts': `import {diagram} from 'svg-diagram';
import {part} from '../shared/part.ts';
export default () => diagram({theme: 'blue'}).add(part);
`,
    'shared/part.ts': `import {box} from 'svg-diagram';
export const part = box({title: 'Shared box'});
`,
  });
  const source = path.join(p.cwd, 'src/figure.ts');
  const map = 'maps/nested/figure.json';
  const args = ['--no-lint', source, '--out', path.join(p.cwd, 'figure.svg'), '--locations', path.join(p.cwd, map)];
  assertStatus(p.run('build', args), 0);
  const first = p.read(map);
  const result = spawnSync(process.execPath, [path.join(root, 'build-diagram.ts'), ...args], {cwd: path.join(p.cwd, 'src'), encoding: 'utf8'});
  assertStatus(result, 0);
  assert.equal(p.read(map), first);
  const locations = readMap(p, map);
  assert.equal(locations.source, '../../src/figure.ts');
  assert.equal(locations.diagram.loc?.file, '../../src/figure.ts');
  assert.equal(locations.parts[0]?.loc.file, '../../shared/part.ts');
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

test('build --stale refreshes the map when the source lines or dependencies move', t => {
  const p = fixture(t, {
    'figure.ts': `import {box, diagram} from 'svg-diagram';
import {part} from './part.ts';
export default () => diagram({theme: 'blue'}).add(box({title: 'Local box'}), part);
`,
    'part.ts': `import {box} from 'svg-diagram';
export const part = box({title: 'Shared box'});
`,
  });
  const flag = ['--locations', 'figure.json'];
  assertStatus(p.build('figure.ts', ...flag), 0);
  const svg = path.join(p.cwd, 'svg/figure.svg');
  for (const [file, lines] of [['figure.ts', [4, 2]], ['part.ts', [4, 3]]] as const) {
    p.write(file, '\n' + p.read(file));
    assertStatus(p.build('figure.ts'), 0);
    fs.utimesSync(svg, 100, 100);
    const result = p.build('figure.ts', '--stale', ...flag);
    assertStatus(result, 0);
    assert.match(result.stdout, /最新（スキップ）/);
    assert.equal(fs.statSync(svg).mtimeMs, 100_000);
    const map = readMap(p);
    assert.deepEqual(map.parts.map(part => part.loc.line), lines);
    const meta = readProvenance(svg);
    assert.ok(meta?.sourceSha256 && meta.depsSha256);
    assert.deepEqual(map.provenance, {sourceSha256: meta.sourceSha256, depsSha256: meta.depsSha256, tool: meta.toolVersion});
  }
  const mapPath = path.join(p.cwd, 'figure.json');
  fs.utimesSync(mapPath, 100, 100);
  assertStatus(p.build('figure.ts', '--stale', ...flag), 0);
  assert.equal(fs.statSync(mapPath).mtimeMs, 100_000);
  const current = readMap(p);
  p.write('figure.json', JSON.stringify({...current, provenance: {...current.provenance, tool: 'old-version'}}));
  assertStatus(p.build('figure.ts', '--stale', ...flag), 0);
  assert.deepEqual(readMap(p), current);
});

test('build --stale refreshes the map when --no-source-line changes', t => {
  const p = fixture(t, {'figure.ts': source.replace("theme: 'blue'", "theme: 'blue', sourceLine: '出典: テスト'")});
  const args = ['figure.ts', '--locations', 'figure.json'];
  assertStatus(p.build(...args), 0);
  const before = readMap(p);
  assertStatus(p.build('--no-source-line', 'figure.ts'), 0);
  const svg = path.join(p.cwd, 'svg/figure.svg');
  fs.utimesSync(svg, 100, 100);
  const result = p.build('--stale', '--no-source-line', ...args);
  assertStatus(result, 0);
  assert.match(result.stdout, /最新（スキップ）/);
  assert.equal(fs.statSync(svg).mtimeMs, 100_000);
  const map = readMap(p);
  assert.ok(map.height < before.height);
  assert.ok(p.read('svg/figure.svg').includes(`viewBox="0 0 ${map.width} ${map.height}"`));
  assert.equal(map.provenance.noSourceLine, true);
  assert.equal(map.provenance.noSourceLine, readProvenance(svg)?.noSourceLine);
});

test('build --stale refreshes the map after a project config edit', t => {
  const p = fixture(t, {'figure.ts': source, '.svg-diagram.json': '{"legend":false}'});
  const args = ['figure.ts', '--locations', 'figure.json'];
  assertStatus(p.build(...args), 0);
  const svg = path.join(p.cwd, 'svg/figure.svg');
  const oldHash = readProvenance(svg)?.configSha256;
  assert.ok(oldHash);
  p.write('.svg-diagram.json', '{"legend":"auto"}');
  assertStatus(p.build('figure.ts'), 0);
  const newHash = readProvenance(svg)?.configSha256;
  assert.ok(newHash && newHash !== oldHash);
  fs.utimesSync(svg, 100, 100);
  const result = p.build('--stale', ...args);
  assertStatus(result, 0);
  assert.match(result.stdout, /最新（スキップ）/);
  assert.equal(fs.statSync(svg).mtimeMs, 100_000);
  assert.equal(readMap(p).provenance.configSha256, newHash);
});

test('build --stale replaces a map whose source path differs', t => {
  const p = fixture(t, {'figure.ts': source, 'other.ts': source});
  assertStatus(p.build('figure.ts', '--locations', 'figure.json'), 0);
  assertStatus(p.build('other.ts', '--locations', 'figure.json'), 0);
  assert.equal(readMap(p).source, 'other.ts');
  const result = p.build('figure.ts', '--stale', '--locations', 'figure.json');
  assertStatus(result, 0);
  assert.match(result.stdout, /最新（スキップ）/);
  assert.equal(readMap(p).source, 'figure.ts');
});

test('build --stale replaces a map with issues after a failed build is fixed', t => {
  const p = fixture(t, {'figure.ts': source});
  const args = ['figure.ts', '--locations', 'figure.json'];
  assertStatus(p.build(...args), 0);
  const good = readMap(p);
  p.write('figure.ts', overlap);
  assertStatus(p.build(...args), 1);
  const failed = readMap(p);
  assert.ok(failed.issues?.length);
  p.write('figure.ts', source);
  assertStatus(p.build('--stale', ...args), 0);
  assert.deepEqual(readMap(p), good);

  // Even matching hashes cannot make a map from a failed build current.
  p.write('figure.json', JSON.stringify({...good, issues: failed.issues}));
  assertStatus(p.build('--stale', ...args), 0);
  assert.deepEqual(readMap(p), good);
});

test('build reports a map write failure without warning about an old SVG', t => {
  const p = fixture(t, {'figure.ts': source.replace("theme: 'blue'", "theme: 'blue', title: 'Flow'"), 'blocked': 'not a directory'});
  for (const flags of [[], ['--stale']]) {
    const result = p.build('figure.ts', '--locations', 'blocked/figure.json', ...flags);
    assertStatus(result, 1);
    assert.ok(p.exists('svg/figure.svg'));
    assert.match(result.stderr.trim(), /^✗ blocked\/figure\.json: [^\n]+$/);
  }
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
  const verify = new URL('../lib/verify-core.ts', import.meta.url).href;
  // Exercise both CLI consumers with a Verdict that carries only the text of each problem.
  p.write('legacy.mjs', `import {registerHooks} from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    const resolved = next(specifier, context);
    if (resolved.url !== ${JSON.stringify(verify)}) return resolved;
    return {url: new URL('./legacy-verify.mjs', import.meta.url).href, shortCircuit: true};
  }
});
`);
  p.write('legacy-verify.mjs', `import {verifyWithServices as verify} from ${JSON.stringify(verify + '?legacy-fixture')};
export function verifyWithServices(services, diagram) {
  const {issues, ...verdict} = verify(services, diagram);
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
