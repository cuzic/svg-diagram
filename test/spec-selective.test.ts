import {tocLegendFinding} from '../lib/toc-rules.ts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderSpec, partCatalog, specSchemaFor, validateSpec} from '../lib/spec-selective.ts';
import {captionDefinition} from '../lib/bands/caption.ts';
import {flowchartPart} from '../lib/spec-parts/selective/flowchart.ts';
import {decisionLadderPart} from '../lib/spec-parts/selective/decision-ladder.ts';
import {funnelPart} from '../lib/spec-parts/selective/funnel.ts';
import {pyramidPart} from '../lib/spec-parts/selective/pyramid.ts';
import {partCatalog as legacyCatalog, specToDiagram} from '../lib/spec.ts';
import {stepsPart} from '../lib/spec-parts/selective/steps.ts';
import {versusPart} from '../lib/spec-parts/selective/versus.ts';
import {burnupPart} from '../lib/spec-parts/selective/burnup.ts';
import {burndownPart} from '../lib/spec-parts/selective/burndown.ts';
import {affinityPart} from '../lib/spec-parts/selective/affinity.ts';
import {boardPart} from '../lib/spec-parts/selective/board.ts';
import {renderInBrowser} from '../lib/web.ts';

import {causeTreePart} from '../lib/spec-parts/selective/cause-tree.ts';
import {cloudPart} from '../lib/spec-parts/selective/cloud.ts';
import {valueChainPart} from '../lib/spec-parts/selective/value-chain.ts';
import {mindmapPart} from '../lib/spec-parts/selective/mindmap.ts';
import {quadrantPart} from '../lib/spec-parts/selective/quadrant.ts';
import {chevronPart} from '../lib/spec-parts/selective/chevron.ts';
import {cyclePart} from '../lib/spec-parts/selective/cycle.ts';
import {stateDiagramPart} from '../lib/spec-parts/selective/state-diagram.ts';
import {ganttPart} from '../lib/spec-parts/selective/gantt.ts';
import {vennPart} from '../lib/spec-parts/selective/venn.ts';
import {tablePart} from '../lib/spec-parts/selective/table.ts';
import {journeyMapPart} from '../lib/spec-parts/selective/journey-map.ts';
import {raciPart} from '../lib/spec-parts/selective/raci.ts';
import {swimlanePart} from '../lib/spec-parts/selective/swimlane.ts';
import {sequencePart} from '../lib/spec-parts/selective/sequence.ts';

import {barsPart} from '../lib/spec-parts/selective/bars.ts';
import {linesPart} from '../lib/spec-parts/selective/lines.ts';
import {stackedBarsPart} from '../lib/spec-parts/selective/stacked-bars.ts';
import {waterfallPart} from '../lib/spec-parts/selective/waterfall.ts';
import {radarPart} from '../lib/spec-parts/selective/radar.ts';
import {paretoPart} from '../lib/spec-parts/selective/pareto.ts';
import {sankeyPart} from '../lib/spec-parts/selective/sankey.ts';
import {treemapPart} from '../lib/spec-parts/selective/treemap.ts';
import {heatmapPart} from '../lib/spec-parts/selective/heatmap.ts';
import {bubblePart} from '../lib/spec-parts/selective/bubble.ts';
import {tornadoPart} from '../lib/spec-parts/selective/tornado.ts';
import {forestPart} from '../lib/spec-parts/selective/forest.ts';
import {strategyCanvasPart} from '../lib/spec-parts/selective/strategy-canvas.ts';
import {bpmnPart} from '../lib/spec-parts/selective/bpmn.ts';
import {classDiagramPart} from '../lib/spec-parts/selective/class-diagram.ts';
import {pertPart} from '../lib/spec-parts/selective/pert.ts';
import {timelinePart} from '../lib/spec-parts/selective/timeline.ts';
import {treePart} from '../lib/spec-parts/selective/tree.ts';
import {dependencyNetworkPart} from '../lib/spec-parts/selective/dependency-network.ts';

import {histogramPart} from '../lib/spec-parts/selective/histogram.ts';
import {scatterPart} from '../lib/spec-parts/selective/scatter.ts';
import {controlChartPart} from '../lib/spec-parts/selective/control-chart.ts';
import {checkSheetPart} from '../lib/spec-parts/selective/check-sheet.ts';
import {rangeBarsPart} from '../lib/spec-parts/selective/range-bars.ts';
import {boxplotPart} from '../lib/spec-parts/selective/boxplot.ts';
import {qfdPart} from '../lib/spec-parts/selective/qfd.ts';
import {whyWhyTablePart} from '../lib/spec-parts/selective/why-why-table.ts';
import {concentricPart} from '../lib/spec-parts/selective/concentric.ts';
import {harveyPart} from '../lib/spec-parts/selective/harvey.ts';
import {comparePart} from '../lib/spec-parts/selective/compare.ts';
import {mekkoPart} from '../lib/spec-parts/selective/mekko.ts';
import {butterflyPart} from '../lib/spec-parts/selective/butterfly.ts';
import {comboPart} from '../lib/spec-parts/selective/combo.ts';

import {faultTreePart} from '../lib/spec-parts/selective/fault-tree.ts';
import {bowtiePart} from '../lib/spec-parts/selective/bowtie.ts';
import {fmeaPart} from '../lib/spec-parts/selective/fmea.ts';
import {isIsNotPart} from '../lib/spec-parts/selective/is-is-not.ts';
import {matrixPart} from '../lib/spec-parts/selective/matrix.ts';
import {pdpcPart} from '../lib/spec-parts/selective/pdpc.ts';
import {relationDiagramPart} from '../lib/spec-parts/selective/relation-diagram.ts';
import {causalLoopPart} from '../lib/spec-parts/selective/causal-loop.ts';
import {whyWhyTreePart} from '../lib/spec-parts/selective/why-why-tree.ts';

test('selected parts reuse legacy schemas and draw without the full spec registry', async () => {
  const parts = [flowchartPart, pyramidPart, funnelPart];
  assert.deepEqual(partCatalog({parts}), legacyCatalog().filter(part => parts.some(p => part.type === p.type)));
  assert.equal(specSchemaFor({parts}).properties?.['parts']?.items?.oneOf?.length, 3);
  const input = {version: 1, title: 'Plan', legend: false, parts: parts.map(part => part.example)};
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const actual = await renderSpec(input, {measure, parts});
  const old = await renderInBrowser(specToDiagram(input), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(actual.xml, []);
  assert.equal(body(actual.svg), body(old.svg));
  assert.match(validateSpec({...input, parts: [funnelPart.example]}, {parts: [pyramidPart]})[0]!.message, /pyramid.*funnel/);
  assert.equal(validateSpec({...input, width: 800, canvas: {}}, {parts})[0]!.path, 'width');
  const dup = validateSpec({...input, parts: [flowchartPart.example, flowchartPart.example]}, {parts});
  assert.equal(dup[0]!.path, 'parts[1].nodes[0].id');
});

test('the selected schema rejects duplicates and validation keywords it cannot enforce', () => {
  assert.throws(() => specSchemaFor({parts: [funnelPart, funnelPart]}), /duplicate part "funnel"/);
  const properties = {...pyramidPart.schema.properties, caption: {type: 'string' as const, pattern: '^a$'}};
  assert.throws(() => specSchemaFor({parts: [{...pyramidPart, schema: {...pyramidPart.schema, properties}}]}),
    /unsupported schema keyword "pattern" at pyramid.properties.caption/);
});

const moreParts = [decisionLadderPart, stepsPart, versusPart, burnupPart, burndownPart, affinityPart, boardPart, faultTreePart, bowtiePart, fmeaPart, isIsNotPart, matrixPart, pdpcPart, relationDiagramPart, causalLoopPart, whyWhyTreePart, histogramPart, scatterPart, controlChartPart, checkSheetPart, rangeBarsPart, boxplotPart, qfdPart, whyWhyTablePart, concentricPart, harveyPart, comparePart, mekkoPart, butterflyPart, comboPart, barsPart, linesPart, stackedBarsPart, waterfallPart, radarPart, paretoPart, sankeyPart, treemapPart, heatmapPart, bubblePart, tornadoPart, forestPart, strategyCanvasPart, bpmnPart, classDiagramPart, pertPart, timelinePart, treePart, dependencyNetworkPart, causeTreePart, cloudPart, valueChainPart, mindmapPart, quadrantPart, chevronPart, cyclePart, stateDiagramPart, ganttPart, vennPart, tablePart, journeyMapPart, raciPart, swimlanePart, sequencePart];
for (const part of moreParts) test(`selected ${part.type} draws the existing catalog example`, async () => {
  const spec = {version: 1, title: 'Plan', legend: false, parts: [part.example]};
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const expected = await renderInBrowser(specToDiagram(spec), {measure});
  const actual = await renderSpec(spec, {parts: [part], measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(actual.xml, []);
  assert.equal(body(actual.svg), body(expected.svg));
});

test('table-based parts share the same renderer in one spec', async () => {
  const parts = [tablePart, raciPart, journeyMapPart];
  const spec = {version: 1, title: 'Plan', legend: false, parts: parts.map(part => part.example)};
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const result = await renderSpec(spec, {parts, measure});
  assert.deepEqual(result.xml, []);
  assert.match(result.svg, /<svg/);
});

test('every existing spec part has a selectable definition with the same schema and example', () => {
  const parts = [flowchartPart, pyramidPart, funnelPart, ...moreParts];
  const ordered = (list: ReturnType<typeof legacyCatalog>) => list.toSorted((a, b) => a.type.localeCompare(b.type));
  assert.deepEqual(ordered(partCatalog({parts})), ordered(legacyCatalog()));
});

test('selected spec supports document styling, language and a fixed-size canvas', async () => {
  const part = stepsPart;
  const input = {
    version: 1, title: 'Project', showTitle: true, desc: 'A sprint plan',
    sourceLine: 'Source: project team', appearance: 'dark', density: 'compact',
    lang: 'en', canvas: {width: 1280, height: 720, minText: 14},
    legend: false, parts: [part.example],
  };
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const actual = await renderSpec(input, {measure, parts: [part], captions: captionDefinition});
  const expected = await renderInBrowser(specToDiagram(input), {measure});
  assert.deepEqual(actual.xml, []);
  assert.equal(actual.width, 1280);
  assert.equal(actual.height, 720);
  assert.match(actual.svg, /data-appearance="dark"/);
  assert.match(actual.svg, /<desc id="svg-desc">A sprint plan<\/desc>/);
  assert.match(actual.svg, /aria-label="Step 1"|>Step 1</);
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.equal(body(actual.svg), body(expected.svg));
  await assert.rejects(renderSpec(input, {measure, parts: [part]}), /captionDefinition/);
});

test('selected canvas scales text and chart geometry and honors content fit', async () => {
  const parts = [ganttPart, radarPart];
  const input = {
    version: 1, title: 'Plan', legend: false, canvas: {width: 1600, height: 900, minText: 20, fit: 'content'},
    parts: parts.map(part => part.example),
  };
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const actual = await renderSpec(input, {measure, parts});
  const expected = await renderInBrowser(specToDiagram(input), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.equal(actual.height, expected.height);
  assert.equal(body(actual.svg), body(expected.svg));
  const overflow = await renderSpec({...input, canvas: {...input.canvas, height: 360}}, {measure, parts});
  assert.ok(overflow.verdict.warnings.some(warning => warning.includes('slide-canvas-overflow')));
});

test('automatic legends require an adapter in the selected schema', async () => {
  const {autoLegend} = await import('../lib/bands/legend.ts');
  const parts = [faultTreePart];
  const input = {version: 1, title: 'Example', legend: 'auto', parts: [faultTreePart.example]};
  assert.ok(validateSpec(input, {parts}).some(issue => issue.path === 'legend'));
  assert.deepEqual(validateSpec(input, {parts, autoLegend}), []);
  assert.deepEqual(specSchemaFor({parts, autoLegend}).properties?.['legend']?.enum, ['auto', false]);
});

test('automatic legends match the legacy catalog SVG in Japanese and English', async () => {
  const {autoLegend} = await import('../lib/bands/legend.ts');
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const parts = [flowchartPart, pyramidPart, funnelPart, ...moreParts];
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  for (const part of parts) {
    for (const lang of ['ja', 'en']) {
      const input = {version: 1, title: 'Example', legend: 'auto', lang, parts: [part.example]};
      const actual = await renderSpec(input, {parts: [part], measure, autoLegend});
      const old = await renderInBrowser(specToDiagram(input), {measure});
      assert.equal(body(actual.svg), body(old.svg), `${part.type} (${lang})`);
    }
  }
});

test('every catalog part matches its legacy SVG on a large canvas', async () => {
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  for (const part of [flowchartPart, pyramidPart, funnelPart, ...moreParts]) {
    const input = {version: 1, title: 'Plan', legend: false,
      canvas: {width: 1920, height: 1080, minText: 20}, parts: [part.example]};
    const actual = await renderSpec(input, {parts: [part], measure});
    const expected = await renderInBrowser(specToDiagram(input), {measure});
    assert.equal(body(actual.svg), body(expected.svg), part.type);
  }
});

test('selected cause analysis reports the same band findings as the legacy spec', async () => {
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  for (const part of [causeTreePart, faultTreePart, bowtiePart, whyWhyTreePart, whyWhyTablePart, isIsNotPart]) {
    const spec = {version: 1, title: 'Plan', legend: false, parts: [part.example]};
    const actual = await renderSpec(spec, {parts: [part], measure});
    const legacy = await renderInBrowser(specToDiagram(spec), {measure});
    const notes = (result: typeof actual) => result.verdict.findings
      .filter(({rule}) => /^(toc|fta|bowtie|whywhy|isisnot)-/.test(rule))
      .map(({rule, severity, message}) => ({rule, severity, message}));
    assert.deepEqual(notes(actual), notes(legacy), part.type);
  }
});

test('selected tables and swimlanes report the same band findings as the legacy spec', async () => {
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  for (const [part, rule] of [[tablePart, 'rowheader-tone-collides'], [swimlanePart, 'swimlane-hand-offs']] as const) {
    const spec = {version: 1, title: 'Plan', legend: false, parts: [part.example]};
    const actual = await renderSpec(spec, {parts: [part], measure});
    const legacy = await renderInBrowser(specToDiagram(spec), {measure});
    const notes = (result: typeof actual) => result.verdict.findings.filter(note => note.rule === rule)
      .map(({rule, severity, message}) => ({rule, severity, message}));
    assert.ok(notes(legacy).length, rule);
    assert.deepEqual(notes(actual), notes(legacy), rule);
    assert.equal(actual.verdict.findings.find(note => note.rule === rule)?.loc?.specPath, 'parts[0]', rule);
    assert.deepEqual(actual.verdict.warnings, legacy.verdict.warnings, rule);
  }
});

test('every catalog part matches the legacy canvas font and overflow findings', async () => {
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  for (const canvas of [{width: 1920, height: 1080, minText: 20}, {width: 1920, height: 360, minText: 14}]) {
    for (const part of [flowchartPart, pyramidPart, funnelPart, ...moreParts]) {
      const spec = {version: 1, title: 'Plan', legend: false, canvas, parts: [part.example]};
      const actual = await renderSpec(spec, {parts: [part], measure});
      const legacy = await renderInBrowser(specToDiagram(spec), {measure});
      const notes = ({verdict}: typeof actual) => verdict.findings.filter(f => f.rule.startsWith('slide-') || f.rule === 'font-floor-lowered');
      assert.deepEqual(notes(actual), notes(legacy), `${part.type} (${canvas.minText}px)`);
    }
  }
});

test('selected layouts keep the legacy frame findings at canvas size', async () => {
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const findings = ({verdict}: Awaited<ReturnType<typeof renderSpec>>) => verdict.findings
    .filter(f => /^layout-(sibling-size|edge-misalign|gutter-uneven|unused-space|align-mixed)$/.test(f.rule))
    .map(({rule, severity, message, data}) => ({rule, severity, message, data}));
  for (const part of [flowchartPart, pyramidPart, funnelPart, ...moreParts]) {
    const input = {version: 1, title: 'Plan', legend: false,
      canvas: {width: 1920, height: 1080, minText: 20}, parts: [part.example]};
    const actual = await renderSpec(input, {parts: [part], measure});
    const legacy = await renderInBrowser(specToDiagram(input), {measure});
    if (part === stepsPart) assert.ok(findings(legacy).some(f => f.rule === 'layout-sibling-size'));
    assert.deepEqual(findings(actual), findings(legacy), part.type);
  }
});

test('every catalog part matches the legacy figure width and offset findings', async () => {
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const findings = ({verdict}: Awaited<ReturnType<typeof renderSpec>>) => verdict.findings
    .filter(f => f.rule === 'layout-figure-offset' || f.rule === 'layout-figure-narrow');
  for (const part of [flowchartPart, pyramidPart, funnelPart, ...moreParts]) {
    const input = {version: 1, title: 'Plan', legend: false, parts: [part.example]};
    const actual = await renderSpec(input, {parts: [part], measure});
    const legacy = await renderInBrowser(specToDiagram(input), {measure});
    assert.deepEqual(findings(actual), findings(legacy), part.type);
  }
});

test('selected Node rendering measures from font files and matches the legacy SVG and verdict', async () => {
  const {renderSpec: renderSelected} = await import('../lib/spec-selective-node.ts');
  const {renderSpec: renderLegacy} = await import('../lib/spec-render.ts');
  const {JA_FONTS} = await import('./helpers/text-engine.ts');
  const input = {version: 1, title: '比較', desc: '比較表', legend: false, parts: [tablePart.example]};
  const actual = await renderSelected(input, {parts: [tablePart], fonts: JA_FONTS});
  assert.deepEqual(actual, await renderLegacy(input, {config: {measure: 'font', fonts: JA_FONTS}}));
  assert.ok(actual.svg);
  const rows = Array.from({length: 22}, (_, index) => [`Plan ${index}`, 'Check', 'Ready', 'Done']);
  const tall = {...input, width: 480, parts: [{...tablePart.example, rows}]};
  const expectedTall = await renderLegacy(tall, {config: {measure: 'font', fonts: JA_FONTS}});
  assert.ok(expectedTall.findings.some(finding => finding.rule === 'aspect-tall'));
  assert.deepEqual(await renderSelected(tall, {parts: [tablePart], fonts: JA_FONTS}), expectedTall);
  const invalid = await renderSelected(input, {parts: [ganttPart], fonts: JA_FONTS});
  assert.equal(invalid.svg, null);
  assert.ok(invalid.issues.length);
});

test('selective spec preparation retains layout geometry for deck consumers', async () => {
  const {prepareSpecLayout} = await import('../lib/spec-selective.ts');
  const {loadSpecPartsFor} = await import('../lib/spec-cli-parts.ts');
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  for (const part of [tablePart, stepsPart, pyramidPart, sequencePart, swimlanePart]) {
    const spec = {version: 1, title: '計画', legend: false, width: part === swimlanePart ? 940 : 480, parts: [part.example]};
    const parts = await loadSpecPartsFor(spec);
    assert.deepEqual(parts?.map(p => p.type), [part.type]);
    assert.ok(parts);
    const layout = await prepareSpecLayout(spec, {parts})(measure);
    const expected = await renderInBrowser(specToDiagram(spec), {measure});
    assert.equal(layout.placed.width, expected.width, part.type);
    assert.equal(layout.placed.canvasHeight, expected.height, part.type);
    assert.ok(layout.placed.laidOut.length, part.type);
    assert.equal(layout.emit(layout.placed), expected.svg, part.type);
    assert.match(layout.emit({...layout.placed, desc: '  説明を指定  '}), /<desc id="svg-desc">説明を指定<\/desc>/);
  }
});

test('prepared spec SVGs describe the same content as the legacy catalog', async () => {
  const {prepareSpecLayout} = await import('../lib/spec-selective.ts');
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const description = (svg: string) => svg.match(/<desc id="svg-desc">[^<]*<\/desc>/)?.[0];
  for (const part of [flowchartPart, pyramidPart, funnelPart, ...moreParts]) {
    const spec = {version: 1, title: '計画', legend: false, parts: [part.example]};
    const layout = await prepareSpecLayout(spec, {parts: [part]})(measure);
    const legacy = await renderInBrowser(specToDiagram(spec), {measure});
    assert.equal(description(layout.emit(layout.placed)), description(legacy.svg), part.type);
  }
});

test('prepared specs batch all text atoms through the project measurement backend', async () => {
  const {prepareSpecLayout} = await import('../lib/spec-selective.ts');
  const {measureAll} = await import('../lib/measure.ts');
  const {measureSettingsOf} = await import('../lib/measure-settings.ts');
  const {JA_FONTS} = await import('./helpers/text-engine.ts');
  const config = {measure: 'font', fonts: JA_FONTS} as const;
  const spec = {version: 1, title: '比較', parts: [tablePart.example], width: 480};
  const draw = prepareSpecLayout(spec, {parts: [tablePart]});
  const batches: number[] = [];
  const layout = await draw({measureBatch: async requests => {
    batches.push(requests.size);
    return measureAll(requests, measureSettingsOf(config));
  }});
  assert.equal(batches.length, 1);
  assert.ok((batches[0] ?? 0) > 1);
  const {renderDiagram} = await import('../lib/dsl/render.ts');
  const {applyConfig} = await import('../lib/config.ts');
  const legacy = await renderDiagram(applyConfig(specToDiagram(spec), config), {name: 'slide1.svg', budget: 'cacheOnly'});
  assert.equal(layout.emit(layout.placed), legacy.svg);
  await assert.rejects(draw({measureBatch: async () => new Map()}), /width was not measured/);
});

test('prepared specs preserve project tones, wrapping and legend defaults', async () => {
  const {prepareSpecLayout} = await import('../lib/spec-selective.ts');
  const {autoLegend} = await import('../lib/bands/legend.ts');
  const {applyConfig} = await import('../lib/config.ts');
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const project = {wrap: 'char', keepWords: true, tones: {accent: {fill: '#ffdd99'}},
    legend: 'auto', legendLabels: {'tone:accent': '確認対象'}} as const;
  const base = {version: 1, title: '計画', width: 400, parts: [{
    type: 'steps', items: [{title: '検討', body: 'プロジェクトのテスト仕様を確認する', tone: 'accent'}, {title: '実行'}],
  }]};
  for (const spec of [base, {...base, legend: false}]) {
    const actual = await prepareSpecLayout(spec, {parts: [stepsPart], autoLegend, project})(measure);
    const legacy = await renderInBrowser(applyConfig(specToDiagram(spec), project), {measure});
    assert.equal(actual.placed.wrap, 'char');
    assert.equal(actual.placed.keepWords, true);
    const svg = actual.emit(actual.placed);
    assert.match(svg, /#ffdd99/);
    assert.equal(svg.includes('確認対象'), !('legend' in spec));
    assert.equal(svg, legacy.svg);
  }
});

test('selected TOC trees suggest a legend once when the spec leaves it unspecified', async () => {
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const {autoLegend} = await import('../lib/bands/legend.ts');
  for (const legend of [undefined, false, 'auto'] as const) {
    const input = {version: 1, title: '計画', parts: [causeTreePart.example, {type: 'causeTree', tree: 'crt', nodes: [{id: 'other', label: 'その他', role: 'ude'}], links: []}],
      ...(legend === undefined ? {} : {legend})};
    const selected = await renderSpec(input, {parts: [causeTreePart], measure, autoLegend});
    const legacy = await renderInBrowser(specToDiagram(input), {measure});
    const notes = ({verdict}: typeof selected) => verdict.findings.filter(f => f.rule === 'toc-legend-suggested');
    assert.deepEqual(notes(legacy), legend === undefined ? [tocLegendFinding()] : []);
    assert.deepEqual(notes(selected), notes(legacy));
  }
});

test('prepared specs preserve the legacy verdict diagnostics across the catalog', async () => {
  const {prepareSpecLayout} = await import('../lib/spec-selective.ts');
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const findings = ({verdict}: Pick<Awaited<ReturnType<typeof renderSpec>>, 'verdict'>) =>
    verdict.findings.toSorted((a, b) => a.rule.localeCompare(b.rule) || a.message.localeCompare(b.message));
  const project = {maxWidth: 720, terms: {変更: ['テスト']}};
  for (const part of [flowchartPart, pyramidPart, funnelPart, ...moreParts]) {
    const input = {version: 1, title: '計画', width: 940, parts: [part.example]};
    const selected = await prepareSpecLayout(input, {parts: [part], project})(measure);
    const legacy = await renderInBrowser({...specToDiagram(input), ...project}, {measure});
    assert.deepEqual(findings(selected), findings(legacy), part.type);
    assert.deepEqual(selected.verdict.warnings, legacy.verdict.warnings, part.type);
    assert.deepEqual(selected.verdict.problems, legacy.verdict.problems, part.type);
  }
});

test('selected contrast problems in steps retain the spec part path', async () => {
  const {prepareSpecLayout} = await import('../lib/spec-selective.ts');
  const {darkOf} = await import('../lib/tokens.ts');
  const tones = {accent: {fill: '#e6d3bd', dark: {fill: darkOf('#22201b')}}};
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const input = {version: 1, title: '計画', appearance: 'dark',
    parts: [{type: 'steps', items: [{title: '入口', tone: 'accent'}, {title: '出口'}]}]};
  const selected = await prepareSpecLayout(input, {parts: [stepsPart], project: {tones}})(measure);
  const legacy = await renderInBrowser({...specToDiagram(input), tones}, {measure});
  const contrast = ({verdict}: Pick<typeof selected, 'verdict'>) => verdict.issues?.filter(issue => issue.message.includes('low contrast'));
  assert.equal(contrast(legacy)?.[0]?.loc?.specPath, 'parts[0]');
  assert.deepEqual(contrast(selected), contrast(legacy));
});

test('selected tables preserve sum and share diagnostics and their spec paths', async () => {
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const input = {version: 1, title: '内訳', parts: [
    {type: 'table', columns: [{label: '項目'}, {label: '件数'}], rows: [['先行', '10'], ['後続', '20'], ['合計', '40']]},
    {type: 'table', columns: [{label: '項目'}, {label: '構成比'}], rows: [['先行', '20%'], ['後続', '30%']]},
  ]};
  const selected = await renderSpec(input, {parts: [tablePart], measure});
  const legacy = await renderInBrowser(specToDiagram(input), {measure});
  const rules = ['table-sum-mismatch', 'table-share-not-100'];
  const notes = ({verdict}: Pick<typeof selected, 'verdict'>) => verdict.findings.filter(f => rules.includes(f.rule));
  assert.deepEqual(notes(legacy).map(f => [f.rule, f.loc?.specPath]), rules.map((rule, i) => [rule, `parts[${i}]`]));
  assert.deepEqual(notes(selected), notes(legacy));
  assert.deepEqual(selected.verdict.warnings, legacy.verdict.warnings);
});

test('every catalog part keeps legacy output or reports the same layout failure under alternate document settings', async () => {
  const {prepareSpecLayout} = await import('../lib/spec-selective.ts');
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const variants = [
    {width: 720}, {width: 480},
    {width: 720, appearance: 'dark', theme: 'teal', density: 'compact'},
    {width: 720, appearance: 'light', theme: 'blue', lang: 'en'},
    {canvas: {width: 1280, height: 720, minText: 16}},
    {canvas: {width: 1440, height: 810, minText: 24}},
  ];
  for (const part of [flowchartPart, pyramidPart, funnelPart, ...moreParts]) {
    for (const settings of variants) {
      const spec = {version: 1, title: '計画', legend: false, ...settings, parts: [part.example]};
      const label = `${part.type} ${JSON.stringify(settings)}`;
      const [selected, legacy] = await Promise.allSettled([
        prepareSpecLayout(spec, {parts: [part]})(measure),
        renderInBrowser(specToDiagram(spec), {measure}),
      ]);
      assert.equal(selected.status, legacy.status, label);
      if (selected.status === 'rejected' && legacy.status === 'rejected') {
        assert.equal(String(selected.reason), String(legacy.reason), label);
      } else if (selected.status === 'fulfilled' && legacy.status === 'fulfilled') {
        const {placed, emit, verdict} = selected.value;
        assert.equal(placed.width, legacy.value.width, label);
        assert.equal(placed.canvasHeight, legacy.value.height, label);
        assert.equal(emit(placed), legacy.value.svg, label);
        assert.deepEqual(verdict.problems, legacy.value.verdict.problems, label);
        assert.deepEqual(verdict.warnings, legacy.value.verdict.warnings, label);
        assert.deepEqual(verdict.issues, legacy.value.verdict.issues, label);
        assert.deepEqual(verdict.findings, legacy.value.verdict.findings, label);
      }
    }
  }
});

test('prepareVerifiedSpecRender adds document diagnostics while the lightweight renderer keeps them optional', async () => {
  const {prepareVerifiedSpecRender} = await import('../lib/spec-selective.ts');
  const rows = Array.from({length: 22}, (_, index) => [`Plan ${index}`, 'Check', 'Ready', 'Done']);
  const input = {version: 1, title: '比較', width: 480, parts: [{...tablePart.example, rows}]};
  const options = {parts: [tablePart]};
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const light = await renderSpec(input, {...options, measure});
  const verified = await prepareVerifiedSpecRender(input, options)(measure);
  assert.equal(verified.svg, light.svg);
  assert.ok(verified.verdict.findings.some(finding => finding.rule === 'aspect-tall'));
  assert.ok(!light.verdict.findings.some(finding => finding.rule === 'aspect-tall'));
});

test("legend: 'auto' without autoLegend names what to pass", async () => {
  const {prepareSpecLayout} = await import('../lib/spec-selective.ts');
  const input = {version: 1, title: 'Plan', parts: [stepsPart.example]};
  assert.throws(() => prepareSpecLayout(input, {parts: [stepsPart], project: {legend: 'auto'}}), /legend: 'auto' needs autoLegend from svg-diagram\/bands\/legend/);
});

test('renderSpec reports document findings only when the caller passes specFindings', async () => {
  const {specFindings} = await import('../lib/spec-selective.ts');
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const input = {version: 1, title: 'vc', width: 480, legend: false, parts: [valueChainPart.example]};
  const plain = await renderSpec(input, {measure, parts: [valueChainPart]});
  const checked = await renderSpec(input, {measure, parts: [valueChainPart], ...specFindings()});
  const has = (r: typeof plain) => r.verdict.findings.some(f => f.rule === 'text-mid-word-break');
  assert.equal(has(plain), false);
  assert.equal(has(checked), true);
});
