import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {box, build, checkDiagram, closeMeasurer, diagram, spacer} from '../lib/dsl.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {captureSourceLocations, sourceOf} from '../lib/source-ref.ts';
import type {LaidOutDiagram} from '../lib/types/index.ts';
import type {Issue} from '../lib/types/verdicts.ts';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'check-diagram.ts');
const lib = path.join(root, 'lib', 'dsl.ts');
const kitchen = path.join(root, 'examples', 'assets', 'kitchen.png');
const imports = `import {areas, box, connect, diagram, grid, image, row, spacer, stat} from ${JSON.stringify(lib)};`;
const overlap = `${imports}
const first = () => box({title: 'First'});
export default function define() {
  return diagram({theme: 'blue'}).add(
    first(),
    spacer(-40),
    box({title: 'Second'}));
}
`;

interface LayoutFinding {
  file: string;
  message: string;
  line?: number;
  column?: number;
  location?: {file: string; line: number; column: number};
  related?: {file: string; line: number; column: number}[];
  via?: {line: number; column: number}[];
}

function fixture(t: TestContext, files: Record<string, string>) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-layout-location-'));
  t.after(() => fs.rmSync(cwd, {recursive: true, force: true}));
  for (const [file, source] of Object.entries(files)) fs.writeFileSync(path.join(cwd, file), source);
  return (format: string, ...sources: string[]) => {
    const result = spawnSync(process.execPath, [cli, '--format', format, ...sources], {cwd, encoding: 'utf8'});
    assert.equal(result.status, 1, result.stdout + result.stderr);
    return result;
  };
}

function layoutFindings(stdout: string): LayoutFinding[] {
  const {findings} = JSON.parse(stdout) as {findings: (LayoutFinding & {rule: string})[]};
  assert.ok(!findings.some(f => f.rule === 'build-error'), stdout);
  return findings.filter(f => f.rule === 'layout');
}

test('layout overlap reports both boxes and the first box’s caller', t => {
  const run = fixture(t, {'overlap.ts': overlap});
  const [finding] = layoutFindings(run('json', 'overlap.ts').stdout);
  assert.match(finding!.message, /"First" overlaps "Second"/);
  assert.deepEqual({line: finding!.line, column: finding!.column, via: finding!.via, related: finding!.related}, {
    line: 2, column: 21, via: [{line: 5, column: 5}], related: [{file: 'overlap.ts', line: 7, column: 5}],
  });

  const text = run('text', 'overlap.ts');
  assert.ok(text.stderr.includes(`✗ overlap.ts:\n  overlap.ts:2:21: ${finding!.message}`), text.stderr);

  const sarif = JSON.parse(run('sarif', 'overlap.ts').stdout);
  const [result] = sarif.runs[0].results;
  assert.deepEqual(result.locations[0].physicalLocation, {
    artifactLocation: {uri: 'overlap.ts'}, region: {startLine: 2, startColumn: 21},
  });
  assert.deepEqual(result.relatedLocations[0].physicalLocation, {
    artifactLocation: {uri: 'overlap.ts'}, region: {startLine: 7, startColumn: 5},
  });
  assert.equal(result.partialFingerprints['svg-diagram/v1'], `overlap.ts\0layout\0${finding!.message}`);
});

test('layout positions from imported parts are reported in that file', t => {
  const run = fixture(t, {
    'parts.ts': `${imports}\nexport const first = box({title: 'First'});\n`,
    'overlap.ts': overlap.replace("const first = () => box({title: 'First'});", "import {first} from './parts.ts';").replace('first(),', 'first,'),
  });
  const [finding] = layoutFindings(run('json', 'overlap.ts').stdout);
  assert.equal(finding!.file, 'overlap.ts');
  assert.equal(finding!.line, undefined);
  assert.deepEqual(finding!.location, {file: 'parts.ts', line: 2, column: 22});
  const github = run('github', 'overlap.ts');
  assert.ok(github.stdout.includes(`::error file=parts.ts,line=2,col=22,title=layout::overlap.ts: ${finding!.message}`), github.stdout);
  const text = run('text', 'overlap.ts');
  assert.ok(text.stderr.includes(`✗ overlap.ts:\n  parts.ts:2:22: ${finding!.message}`), text.stderr);
});

test('layout nowrap and contrast point to row and grid children', t => {
  const run = fixture(t, {'children.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue', tones: {accent: {fill: '#222222'}}}).add(
    row([
      stat('8'.repeat(100), 'row value'),
      box({title: 'Row contrast', tone: 'accent'}),
    ]),
    grid([
      stat('9'.repeat(100), 'grid value'),
      box({title: 'Grid contrast', tone: 'accent'}),
    ], {cols: 2}));
}
`});
  const findings = layoutFindings(run('json', 'children.ts').stdout);
  assert.deepEqual(findings.filter(f => f.message.startsWith('stat:')).map(f => f.line), [5, 9]);
  assert.deepEqual(findings.filter(f => f.message.includes('has low contrast')).map(f => f.line), [6, 10]);
});

test('layout connects report their own position and the box the label overlaps', t => {
  const run = fixture(t, {'connect.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue'}).add(
    image(${JSON.stringify(kitchen)}, {alt: 'kitchen', width: 260, pad: 24, over: [
      box({id: 'a', title: 'Above'}),
      box({id: 'b', title: 'Below'}),
    ]}),
    connect('a:bottom', 'b:top', {label: 'Label', chip: true}));
}
`});
  const hits = layoutFindings(run('json', 'connect.ts').stdout).filter(f => f.message.includes('label "Label" overlaps'));
  assert.ok(hits.length);
  for (const hit of hits) {
    assert.equal(hit.line, 8);
    assert.equal(hit.related?.[0]?.line, hit.message.includes('"Above"') ? 5 : 6);
  }
});

test('layout bounds point to the box inside an areas wrapper row', t => {
  const run = fixture(t, {'bounds.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue'}).add(
    spacer(-120),
    areas('a', {
      a: box({title: 'Outside'}),
    }));
}
`});
  const found = layoutFindings(run('json', 'bounds.ts').stdout).find(f => /"Outside".*exceeds/.test(f.message));
  assert.equal(found?.line, 6);
});

test('layout auto appearance keeps identical dark-only issues on distinct boxes', t => {
  const run = fixture(t, {'auto.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue', appearance: 'auto', tones: {accent: {fill: '#e6d3bd', dark: {fill: '#e8e6e0'}}}}).add(
    box({title: 'Repeated', tone: 'accent'}),
    box({title: 'Repeated', tone: 'accent'}));
}
`});
  const findings = layoutFindings(run('json', 'auto.ts').stdout);
  assert.deepEqual(findings.map(f => f.line), [4, 5]);
  assert.equal(findings[0]!.message, findings[1]!.message);
  assert.match(findings[0]!.message, /has low contrast.*\(暗い配色\)$/);
});

test('build layout failure carries the issues and layout before writing SVG', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-layout-build-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  t.after(() => closeMeasurer());
  captureSourceLocations(true);
  t.after(() => captureSourceLocations(false));
  const first = box({title: 'First'});
  const second = box({title: 'Second'});
  const d = diagram({theme: 'blue'}).add(first, spacer(-40), second);
  const {verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, verdict.issues.map(i => i.message));
  const out = path.join(dir, 'bad.svg');
  await assert.rejects(build(d, out), (err: Error & {issues?: Issue[]; laidOut?: LaidOutDiagram}) => {
    assert.match(err.message, /layout verification failed/);
    assert.deepEqual(err.issues, verdict.issues);
    assert.ok(err.laidOut?.laidOut.some(b => sourceOf(b) === sourceOf(second)));
    assert.equal(err.issues?.[0]?.loc, sourceOf(first));
    return true;
  });
  assert.ok(!fs.existsSync(out));
});

test('all example verdict.problems match the main baseline', async t => {
  installResolveHook();
  captureSourceLocations(true);
  t.after(() => captureSourceLocations(false));
  t.after(() => closeMeasurer());
  const examples = fs.globSync('examples/*.ts', {cwd: root}).sort();
  assert.ok(examples.length > 0);
  // At 2dd0a1b, each of the 191 example sources returned an empty problems array.
  for (const file of examples) {
    const {verdict} = await checkDiagram(await loadDiagram(path.join(root, file)));
    assert.deepEqual(verdict.problems, [], file);
  }
});
