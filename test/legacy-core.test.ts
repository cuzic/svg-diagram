import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {DEF, defOf} from '../lib/band-def.ts';
import {boxDefinition} from '../lib/bands/box.ts';
import {rowDefinition} from '../lib/bands/row.ts';
import {box, bubble, canvas, causeTree, chevron, connect, diagram, faultTree, group, legend, row, screens, stateMatrix, waterfall, wf} from '../lib/dsl-pure.ts';
import {FULL_DEFINITIONS, UNDEFINED_BANDS, definitionFor} from '../lib/full-definitions.ts';
import {attachDefinitions, prepareLegacyDiagramWithCore, renderLegacyDiagramWithCore, unsupportedCoreOptions} from '../lib/legacy-core.ts';
import type {MeasureRequest} from '../lib/types/core.ts';
import {renderInBrowser} from '../lib/web.ts';

const measure = ({text, size}: MeasureRequest) => ({w: [...text].length * size * 0.6, h: size});

test('the full definition table accounts for every legacy band type', () => {
  for (const [type, entry] of Object.entries(FULL_DEFINITIONS)) {
    if (typeof entry !== 'function') assert.equal(entry.type, type);
  }
  for (const reason of Object.values(UNDEFINED_BANDS)) assert.ok(typeof reason === 'string' && reason.trim());
});

test('the full definition table selects the chart and screens variants from their data', () => {
  const bubbleBand = bubble([{label: 'A', x: 1, y: 2, size: 3}]);
  const chartBand = waterfall([{label: 'A', value: 2}, {label: 'B', value: 1}]);
  const content = wf.text('Screen');
  const screenBand = screens([{id: 'screen', title: 'Screen', root: content}]);
  const matrixBand = stateMatrix(['Desktop'], [{label: 'Start', cells: [content]}]);
  assert.equal(definitionFor(bubbleBand)?.type, 'chart');
  assert.equal(definitionFor(chartBand)?.type, 'chart');
  assert.notEqual(definitionFor(bubbleBand), definitionFor(chartBand));
  assert.equal(definitionFor(screenBand)?.type, 'screens');
  assert.equal(definitionFor(matrixBand)?.type, 'screens');
  assert.notEqual(definitionFor(screenBand), definitionFor(matrixBand));
});

test('attachDefinitions copies the legacy bands and decorates the nested children', () => {
  const legacyRow = row([box({title: '開始'}), box({title: '完了'})]);
  const d = diagram({theme: 'blue'}).add(legacyRow);
  const [copy] = attachDefinitions(d);
  assert.equal(copy?.type, 'row');
  assert.notEqual(copy, legacyRow);
  assert.equal(defOf(copy), rowDefinition);
  assert.notEqual(copy.children[0], legacyRow.children[0]);
  assert.equal(defOf(copy.children[0]!), boxDefinition);
  assert.equal(DEF in legacyRow, false);
  assert.ok(legacyRow.children.every(child => !(DEF in child)));
});

test('the core renders a legacy row of two boxes and their connector at the legacy width', async () => {
  const d = diagram({theme: 'blue', width: 640, legend: false, title: '作業の流れ', showTitle: true, sourceLine: '出典: 例', status: 'draft', statusLabel: '仮説'}).add(
    row([box({title: '開始', id: 'start'}), box({title: '完了', id: 'end'})]),
    connect('start', 'end'),
  );
  const legacy = await renderInBrowser(d, {measure});
  const core = await renderLegacyDiagramWithCore(d, {measure});
  assert.equal(core.width, legacy.width);
  assert.deepEqual(core.xml, []);
  assert.deepEqual(core.verdict.problems, []);
  assert.deepEqual(core.unsupported, []);
  assert.match(core.svg, /marker-end="url\(#/);
  assert.match(core.svg, /data-status="draft"[\s\S]*仮説[\s\S]*作業の流れ[\s\S]*開始[\s\S]*出典: 例/);
  assert.ok(core.verdict.findings.some(finding => finding.rule === 'draft-status'));
});

test('prepareLegacyDiagramWithCore checks a raw band without invoking its drawing function', async () => {
  const d = diagram({theme: 'blue'}).add({
    type: 'raw', h: 12, draw: () => { throw new Error('called only when emitting'); },
  });
  const prepared = await prepareLegacyDiagramWithCore(d, {measure});
  assert.equal(prepared.verdict.ok, true);
  assert.throws(() => prepared.emit(prepared.placed), /called only when emitting/);
});

test('the core draws a legacy spotlight at the supplied width', async () => {
  const d = diagram({theme: 'blue', width: 640, spotlight: 'start'}).add(box({title: '開始', id: 'start'}));
  const core = await renderLegacyDiagramWithCore(d, {measure});
  assert.deepEqual(core.unsupported, []);
  assert.deepEqual(core.unsupported, unsupportedCoreOptions(d));
  assert.equal(core.laidOut.laidOut[0]?.dim, false);
  assert.equal(core.width, d.width);
});

test('the core leaves notation from dimmed row children and edges out of the automatic legend', async () => {
  const d = diagram({theme: 'blue', legend: 'auto', spotlight: {ids: 'choices#2', edges: 'between'}}).add(
    row([box({id: 'other', title: '別案', tone: 'danger'}), box({id: 'main', title: '本案', tone: 'accent'})], {id: 'choices'}),
    box({id: 'end', title: '完了'}),
    connect('main', 'end', {line: 'dashed'}),
  );
  const legacy = await renderInBrowser(d, {measure});
  const core = await renderLegacyDiagramWithCore(d, {measure});
  const automatic = core.laidOut.bands.find(b => b.type === 'legend');
  assert.deepEqual(automatic?.items, [{tone: 'accent', label: '強調'}]);
  assert.equal(core.svg, legacy.svg);
});

test('the core draws the automatic legend with the legacy height and custom labels', async () => {
  const d = diagram({theme: 'blue', legend: 'auto', legendLabels: {'tone:accent': '要確認'}, sourceLine: '出典: 例'}).add(
    box({title: '開始', tone: 'accent'}),
  );
  const legacy = await renderInBrowser(d, {measure});
  const core = await renderLegacyDiagramWithCore(d, {measure});
  assert.match(core.svg, />要確認<\/text>[\s\S]*>出典: 例<\/text>/);
  assert.equal(core.height, legacy.height);
  assert.deepEqual(core.unsupported, []);
});

test('the core appends automatic items to an existing legend', async () => {
  const d = diagram({theme: 'blue', legend: 'auto'}).add(
    box({title: '開始', tone: 'accent'}),
    legend([{tone: 'muted', label: '任意'}]),
  );
  const legacy = await renderInBrowser(d, {measure});
  const core = await renderLegacyDiagramWithCore(d, {measure});
  assert.match(core.svg, />任意<\/text>[\s\S]*>強調<\/text>/);
  assert.equal(core.height, legacy.height);
});

test('the core keeps the grayscale, missing legend and tall document findings', async () => {
  const d = diagram({theme: 'blue', width: 320, gap: 480}).add(
    box({title: '通常'}), box({title: '強調', tone: 'accent'}),
  );
  const legacy = await renderInBrowser(d, {measure});
  const core = await renderLegacyDiagramWithCore(d, {measure});
  for (const rule of ['gray-tone-collision', 'legend-missing', 'aspect-tall']) {
    const expected = legacy.verdict.findings.find(finding => finding.rule === rule);
    assert.ok(expected, rule);
    const actual = core.verdict.findings.find(finding => finding.rule === rule);
    assert.equal(actual?.message, expected.message, rule);
    assert.equal(actual?.severity, expected.severity, rule);
  }
});

test('the core fits a narrow figure at the legacy width', async () => {
  const d = diagram({theme: 'blue', width: 'fit'}).add(chevron([{label: '開始'}], {direction: 'vertical', width: 420}));
  const legacy = await renderInBrowser(d, {measure});
  const core = await renderLegacyDiagramWithCore(d, {measure});
  assert.ok(legacy.width < d.width);
  assert.equal(core.width, legacy.width);
  assert.deepEqual(core.unsupported, []);
});

test('the core draws transparent diagrams without a page rectangle', async () => {
  const d = diagram({theme: 'blue', transparent: true, appearance: 'dark'}).add(box({title: '開始'}));
  const legacy = await renderInBrowser(d, {measure});
  const core = await renderLegacyDiagramWithCore(d, {measure});
  assert.match(core.svg, /data-assumed-bg="#[a-f0-9]+"/i);
  assert.doesNotMatch(core.svg, /<rect x="0" y="0"/);
  assert.equal(core.svg.match(/data-assumed-bg="[^"]+"/)?.[0], legacy.svg.match(/data-assumed-bg="[^"]+"/)?.[0]);
  assert.deepEqual(core.unsupported, []);
});

test('the core keeps strict TOC, cause analysis, and layout findings as warnings', async () => {
  const d = diagram({theme: 'blue', tocCheck: 'strict', rcaCheck: 'strict', layoutCheck: 'strict', legend: false}).add(
    causeTree([{id: 'ude', label: '望ましくない結果', role: 'ude'}], [], {tree: 'nbr'}),
    chevron([{label: '開始'}], {direction: 'vertical', width: 420}),
  );
  const cases = [
    [d, 'toc-nbr-parts'],
    [diagram({theme: 'blue', rcaCheck: 'strict'}).add(faultTree({label: '故障', kind: 'basic'})), 'fta-top-is-leaf'],
    [diagram({theme: 'blue', layoutCheck: 'strict'}).add(chevron([{label: '開始'}], {direction: 'vertical', width: 420})), 'layout-figure-narrow'],
  ] as const;
  for (const [data, rule] of cases) {
    const legacy = await renderInBrowser(data, {measure});
    const core = await renderLegacyDiagramWithCore(data, {measure});
    assert.equal(legacy.verdict.findings.find(finding => finding.rule === rule)?.severity, 'warn', rule);
    assert.equal(core.verdict.findings.find(finding => finding.rule === rule)?.severity, 'warn', rule);
    assert.deepEqual(core.unsupported, []);
  }
});

test('the core uses the effective legacy width of a whole-slide canvas', async () => {
  const d = diagram({theme: 'blue', width: 640, canvas: {width: 800, height: 480}}).add(box({title: '開始'}));
  const legacy = await renderInBrowser(d, {measure});
  const core = await renderLegacyDiagramWithCore(d, {measure});
  assert.equal(core.width, legacy.width);
  assert.equal(core.height, legacy.height);
  assert.deepEqual(core.unsupported, []);
});

test('the core measures and emits the heading generated by a nested canvas grid', async () => {
  const d = diagram({theme: 'blue'}).add(group(canvas('swot', {}, {title: '現状分析'})));
  const measured = new Set<string>();
  const core = await renderLegacyDiagramWithCore(d, {measure(request) {
    if (request.weight === 700) measured.add(request.text);
    return measure(request);
  }});
  assert.ok(measured.has('現') && measured.has('析'));
  assert.match(core.svg, />現状分析<\/text>/);
});

test('the legacy core bundles for browsers without the Node TeX loader', async () => {
  const result = await build({
    entryPoints: ['lib/legacy-core.ts'], bundle: true, platform: 'browser', write: false, metafile: true, logLevel: 'silent',
  });
  assert.ok(Object.keys(result.metafile.inputs).every(file => !/mathjax|math-tex/.test(file)));
});
