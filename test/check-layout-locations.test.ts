import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspect} from 'node:util';
import {box, build, callout, checkDiagram, closeMeasurer, connect, diagram, row, spacer, stat} from '../lib/dsl.ts';
import {renderInBrowser} from '../lib/web.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {captureSourceLocations, sourceOf} from '../lib/source-ref.ts';
import type {LaidOutDiagram} from '../lib/types/index.ts';
import type {Issue} from '../lib/types/verdicts.ts';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'check-diagram.ts');
const lib = path.join(root, 'lib', 'dsl.ts');
const kitchen = path.join(root, 'examples', 'assets', 'kitchen.png');
const imports = `import {areas, box, callout, caption, connect, diagram, grid, image, row, spacer, stat} from ${JSON.stringify(lib)};`;
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

function fixture(t: TestContext, files: Record<string, string>, status = 1) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-layout-location-'));
  t.after(() => fs.rmSync(cwd, {recursive: true, force: true}));
  for (const [file, source] of Object.entries(files)) fs.writeFileSync(path.join(cwd, file), source);
  return (format: string, ...sources: string[]) => {
    const result = spawnSync(process.execPath, [cli, '--format', format, ...sources], {cwd, encoding: 'utf8'});
    assert.equal(result.status, status, result.stdout + result.stderr);
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

test('check reports the specToDiagram call for a thrown layout error and an overlap', async t => {
  const figure = (col: number, colGap: number) => `import {specToDiagram} from 'svg-diagram/spec';
const lane = (prefix: string, col: number, colGap = 28) => ({
  type: 'swimlane',
  lanes: [{id: 'a', label: '担当'}],
  steps: [{id: prefix + '1', lane: 'a', title: '共有', col: 1}, {id: prefix + '2', lane: 'a', title: '確認', col}],
  colGap,
});
export default function define() {
  return specToDiagram({version: 1, title: '例', parts: [lane('a', 2), lane('b', ${col}, ${colGap})]});
}
`;
  const run = fixture(t, {
    // Expose the source entry under its published name without building dist.
    'package.json': JSON.stringify({name: 'svg-diagram', type: 'module', exports: {'./spec': './spec-entry.ts'}}),
    'spec-entry.ts': `export {specToDiagram} from ${JSON.stringify(path.join(root, 'lib', 'spec.ts'))};`,
    'specfig.ts': figure(8, 96),
    'specfig-overlap.ts': figure(1, 28),
  });

  for (const [file, rule, message] of [
    ['specfig.ts', 'build-error', 'swimlane(): 8 columns leave only'],
    ['specfig-overlap.ts', 'layout', '"共有" overlaps "確認"'],
  ] as const) {
    await t.test(rule, () => {
      const json = run('json', file).stdout;
      const {findings} = JSON.parse(json) as {findings: (LayoutFinding & {rule: string})[]};
      const finding = findings.find(f => f.rule === rule && f.message.startsWith(message));
      assert.deepEqual([finding?.file, finding?.line, finding?.column], [file, 9, 10], json);
      const {stderr} = run('text', file);
      assert.ok(stderr.includes(`${file}:9:10: ${message}`), stderr);
    });
  }
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

test('layout nowrap points to a top-level stat', t => {
  const run = fixture(t, {'stat.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue'}).add(
    stat('8'.repeat(100), 'Top-level value'));
}
`});
  const finding = layoutFindings(run('json', 'stat.ts').stdout).find(f => f.message.startsWith('stat:'));
  assert.deepEqual([finding?.line, finding?.column], [4, 5]);
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

test('layout callout overflow points to the callout for the line and label', t => {
  const run = fixture(t, {'callout.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue'}).add(
    box({id: 'x', title: 'Target'}),
    callout('x', {text: 'Right', side: 'right'}));
}
`});
  const findings = layoutFindings(run('json', 'callout.ts').stdout);
  assert.deepEqual(findings.map(f => ({
    part: /^callout\(x\) (line|label "Right") runs outside/.exec(f.message)?.[1], line: f.line, column: f.column,
  })), [{part: 'line', line: 5, column: 5}, {part: 'label "Right"', line: 5, column: 5}]);
});

test('layout callout collisions point to the callout and the caption', t => {
  const run = fixture(t, {'caption.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue'}).add(
    caption('Heading', {bold: true}),
    row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), box({id: 'c', title: 'C'})]),
    callout('b', {text: 'Above'}));
}
`});
  const hits = layoutFindings(run('json', 'caption.ts').stdout).filter(f => f.message.includes('overlaps the caption "Heading"'));
  assert.ok(hits.length > 0);
  for (const hit of hits) {
    assert.deepEqual([hit.line, hit.column], [6, 5]);
    assert.deepEqual(hit.related, [{file: 'caption.ts', line: 4, column: 5}]);
  }
});

test('layout loop-side line overflow points to the connect', t => {
  const run = fixture(t, {'loop.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue'}).add(
    box({id: 'a', title: 'First'}),
    box({id: 'b', title: 'Second'}),
    connect('b:left', 'a:left', {route: 'loop-side'}));
}
`});
  const finding = layoutFindings(run('json', 'loop.ts').stdout).find(f => f.message.includes('the boxes leave no room beside them'));
  assert.deepEqual([finding?.line, finding?.column], [6, 5]);
});

test('layout loop-side label overflow points to the connect', t => {
  const run = fixture(t, {'loop-label.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue'}).add(
    row([box({id: 'a', title: 'First', width: 700})], {justify: 'center'}),
    row([box({id: 'b', title: 'Second', width: 700})], {justify: 'center'}),
    connect('b:left', 'a:left', {route: 'loop-side', label: 'Return to the first box'}));
}
`});
  const finding = layoutFindings(run('json', 'loop-label.ts').stdout).find(f => f.message.includes('label "Return to the first box" runs outside'));
  assert.deepEqual([finding?.line, finding?.column], [6, 5]);
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

test('build layout failure carries non-enumerable issues and layout before writing SVG', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-layout-build-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  t.after(() => closeMeasurer());
  captureSourceLocations(true);
  t.after(() => captureSourceLocations(false));
  const first = box({title: 'First'});
  const second = box({title: 'Second'});
  const d = diagram({theme: 'blue'}).add(first, spacer(-40), second);
  const {verdict} = await checkDiagram(d);
  assert.ok(verdict.issues);
  assert.deepEqual(verdict.problems, verdict.issues.map(i => i.message));
  const out = path.join(dir, 'bad.svg');
  await assert.rejects(build(d, out), (err: Error & {issues?: Issue[]; laidOut?: LaidOutDiagram}) => {
    assert.match(err.message, /layout verification failed/);
    assert.deepEqual(err.issues, verdict.issues);
    assert.ok(err.laidOut?.laidOut.some(b => sourceOf(b) === sourceOf(second)));
    assert.equal(err.issues?.[0]?.loc, sourceOf(first));
    assert.doesNotMatch(inspect(err), /\b(?:issues|laidOut):/);
    assert.equal(JSON.stringify(err), '{}');
    assert.equal(Object.getOwnPropertyDescriptor(err, 'issues')?.enumerable, false);
    assert.equal(Object.getOwnPropertyDescriptor(err, 'laidOut')?.enumerable, false);
    return true;
  });
  assert.ok(!fs.existsSync(out));
});

test('layout problems keep their messages without source capture', async () => {
  captureSourceLocations(false);
  const d = diagram({
    theme: 'blue', width: 400, appearance: 'auto',
    tones: {muted: {fill: '#222222'}, accent: {fill: '#e6d3bd', dark: {fill: '#e8e6e0'}}},
  }).add(
    spacer(-80),
    box({id: 'a', title: 'First', tone: 'muted'}),
    spacer(-32),
    box({id: 'b', title: 'Second'}),
    row([stat('88888888888888888888888888888888', 'Row value')]),
    box({title: 'Repeated', tone: 'accent'}),
    box({title: 'Repeated', tone: 'accent'}),
    connect('a:bottom', 'b:top', {label: 'Label', chip: true}),
    callout('b', {text: 'Right', side: 'right'}),
    connect('b:left', 'a:left', {route: 'loop-side'}),
  );
  // Fixed widths keep the messages' dimensions independent of installed fonts.
  const draw = async (appearance: 'light' | 'auto') => (await renderInBrowser({...d, appearance}, {
    measure: ({text, size}) => ({w: text.length * size / 2, h: size}),
  })).verdict.problems;
  const light = [
    '"First" overlaps "Second" by 360x17px',
    `connect(a:bottom -> b:top) label "Label" overlaps its own end "First" by 51x20px (widen the gap between the boxes, shorten the label, or label a longer leg with route: 'elbow')`,
    `connect(a:bottom -> b:top) label "Label" overlaps its own end "Second" by 51x21px (widen the gap between the boxes, shorten the label, or label a longer leg with route: 'elbow')`,
    'callout(b) line runs outside the 400x297 canvas (put the bubble on another side, or leave room with spacer())',
    'callout(b) label "Right" runs outside the 400x297 canvas (put the bubble on another side, or leave room with spacer())',
    `connect(b:left -> a:left) runs outside the 400x297 canvas: the boxes leave no room beside them for route: 'loop-side' (narrow them: row([box({id, width: 700})], {justify: 'center'}) per step, or give dip a smaller value)`,
    'stat: value "88888888888888888888888888888888" does not fit its box even at the smallest size (24px: needs 384px, the box has 320px).\n'
      + '  fix: widen the box (span / flex / width), shorten the value, or put the unit in the label.',
    '"First" at (20,-60) 360x53 exceeds the 400x297 canvas',
    '"Second" at (20,-24) 360x53 exceeds the 400x297 canvas',
    '"First" (#22201b on #222222, in "First") has low contrast (delta=2, want >= 70)',
  ];
  assert.deepEqual((await draw('light')).sort(), [...light].sort());
  assert.deepEqual((await draw('auto')).sort(), [
    ...light,
    '"Repeated" (#22201b on #e6d3bd, in "Repeated") has low contrast (delta=1, want >= 70) (暗い配色)',
  ].sort());
});

test('all examples stay free of layout problems with source capture enabled', async t => {
  installResolveHook();
  captureSourceLocations(true);
  t.after(() => captureSourceLocations(false));
  t.after(() => closeMeasurer());
  const examples = fs.globSync('examples/*.ts', {cwd: root}).sort();
  assert.ok(examples.length > 0);
  for (const file of examples) {
    const {verdict} = await checkDiagram(await loadDiagram(path.join(root, file)));
    assert.deepEqual(verdict.problems, [], file);
  }
});

test('check reports both identical headlines and keeps an accepted box finding on its own line', t => {
  const run = fixture(t, {'rules.ts': `${imports}
export default function define() {
  const headline = '見出し'.repeat(16);
  return diagram({theme: 'blue', medium: 'doc', appearance: 'auto', legend: false,
    accept: {'box-size-ignored': '既存の設定'}}).add(
    caption(headline, {role: 'title'}),
    caption(headline, {role: 'title'}),
    row([box({title: 'A', size: 24}), box({title: 'B'})]));
}
`});
  const {findings} = JSON.parse(run('json', '--strict', 'rules.ts').stdout) as {
    findings: (LayoutFinding & {rule: string; severity: string})[];
  };
  assert.deepEqual(findings.filter(f => f.rule === 'cjk-line-long').map(f => [f.line, f.column]), [[6, 5], [7, 5]], JSON.stringify(findings));
  const accepted = findings.find(f => f.rule === 'box-size-ignored');
  assert.equal(accepted?.line, 8);
  assert.equal(accepted?.column, 10);
  assert.equal(accepted?.severity, 'info');
  assert.match(accepted.message, /許容: 既存の設定/);
});

test('check keeps the main baseline for three boxes with the same failing contrast', t => {
  // Written by main (44b006d) with check --write-baseline baseline.json contrast.ts.
  const baseline = fs.readFileSync(new URL('./fixtures/contrast-main-baseline.json', import.meta.url), 'utf8');
  const run = fixture(t, {
    'baseline.json': baseline,
    'contrast.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue', medium: 'doc', title: '配色', legend: false,
    tones: {accent: {fill: '#808080', stroke: '#808080'}}}).add(
    row([
      box({title: '一つ目', tone: 'accent'}),
      box({title: '二つ目', tone: 'accent'}),
      box({title: '三つ目', tone: 'accent'}),
    ]));
}
`,
  }, 0);
  const accepted = run('json', '--strict', '--baseline', 'baseline.json', 'contrast.ts');
  const main = JSON.parse(baseline).warnings;
  const {findings} = JSON.parse(run('json', 'contrast.ts').stdout) as {
    findings: (LayoutFinding & {rule: string; severity: string})[];
  };
  const warnings = findings.filter(f => f.severity === 'warn');
  assert.deepEqual(warnings.map(({file, rule, message}) => ({file, rule, message})), main);
  for (const f of warnings) {
    assert.deepEqual([f.line, f.column], [6, 7]);
    assert.deepEqual(f.related, [7, 8].map(line => ({file: 'contrast.ts', line, column: 7})));
  }
  assert.equal(JSON.parse(accepted.stdout).findings.filter((f: {message: string}) => f.message.endsWith('（ベースライン済み）')).length, 2);
});

test('check limits grouped rule locations in JSON and SARIF to ten related parts', t => {
  const run = fixture(t, {'many.ts': `${imports}
export default function define() {
  return diagram({theme: 'blue', medium: 'doc', title: '配色', legend: false,
    tones: {accent: {fill: '#808080', stroke: '#808080'}}}).add(
${Array.from({length: 12}, (_, i) => `    box({title: '箱 ${i + 1}', tone: 'accent'})`).join(',\n')});
}
`});
  const rule = 'a11y-nontext-contrast';
  const {findings} = JSON.parse(run('json', '--strict', 'many.ts').stdout) as {findings: (LayoutFinding & {rule: string})[]};
  const hit = findings.find(f => f.rule === rule);
  assert.equal(hit?.line, 5);
  const lines = Array.from({length: 10}, (_, i) => i + 6);
  assert.deepEqual(hit.related, lines.map(line => ({file: 'many.ts', line, column: 5})));
  const {runs} = JSON.parse(run('sarif', '--strict', 'many.ts').stdout);
  const result = runs[0].results.find((r: {ruleId: string}) => r.ruleId === rule);
  assert.deepEqual(result.relatedLocations, lines.map((line, i) => ({
    id: i + 1, physicalLocation: {artifactLocation: {uri: 'many.ts'}, region: {startLine: line, startColumn: 5}},
  })));
});

test('check reports an imported rule source and the other part in a chart pair', t => {
  const chartImport = `import {bars, diagram} from ${JSON.stringify(lib)};`;
  const run = fixture(t, {
    'parts.ts': `${chartImport}
export const first = bars([{label: '前', value: 5}], {unit: '件', max: 6});
`,
    'charts.ts': `${chartImport}
import {first} from './parts.ts';
const second = () => bars([{label: '後', value: 5}], {unit: '件', max: 10});
export default () => diagram({theme: 'blue', title: '比較'}).add(first, second());
`,
  });
  const {findings} = JSON.parse(run('json', '--strict', 'charts.ts').stdout) as {findings: (LayoutFinding & {rule: string})[]};
  const finding = findings.find(f => f.rule === 'chart-axis-mismatch');
  assert.ok(finding);
  assert.equal(finding.file, 'charts.ts');
  assert.deepEqual(finding.location, {file: 'parts.ts', line: 2, column: 22});
  assert.deepEqual(finding.related, [{file: 'charts.ts', line: 3, column: 22}]);

  const github = run('github', '--strict', 'charts.ts').stdout;
  assert.ok(github.includes('::warning file=parts.ts,line=2,col=22,title=chart-axis-mismatch::charts.ts: '), github);
  const text = run('text', '--strict', 'charts.ts').stdout;
  assert.ok(text.includes('⚠ parts.ts:2:22: [chart-axis-mismatch]'), text);
  const sarif = JSON.parse(run('sarif', '--strict', 'charts.ts').stdout);
  const result = sarif.runs[0].results.find((r: {ruleId: string}) => r.ruleId === 'chart-axis-mismatch');
  assert.deepEqual(result.locations[0].physicalLocation, {
    artifactLocation: {uri: 'parts.ts'}, region: {startLine: 2, startColumn: 22},
  });
  assert.deepEqual(result.relatedLocations[0].physicalLocation, {
    artifactLocation: {uri: 'charts.ts'}, region: {startLine: 3, startColumn: 22},
  });
  assert.equal(result.partialFingerprints['svg-diagram/v1'], `charts.ts\0chart-axis-mismatch\0${finding.message}`);
});
