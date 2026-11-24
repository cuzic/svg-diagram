import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderSpec, partCatalog, specSchemaFor, validateSpec} from '../lib/spec-selective.ts';
import {captionDefinition} from '../lib/bands/caption.ts';
import {flowchartPart} from '../lib/spec-parts/selective/flowchart.ts';
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

const moreParts = [stepsPart, versusPart, burnupPart, burndownPart, affinityPart, boardPart, faultTreePart, bowtiePart, fmeaPart, isIsNotPart, matrixPart, pdpcPart, relationDiagramPart, causalLoopPart, whyWhyTreePart, histogramPart, scatterPart, controlChartPart, checkSheetPart, rangeBarsPart, boxplotPart, qfdPart, whyWhyTablePart, concentricPart, harveyPart, comparePart, mekkoPart, butterflyPart, comboPart, barsPart, linesPart, stackedBarsPart, waterfallPart, radarPart, paretoPart, sankeyPart, treemapPart, heatmapPart, bubblePart, tornadoPart, strategyCanvasPart, bpmnPart, classDiagramPart, pertPart, timelinePart, treePart, dependencyNetworkPart, causeTreePart, cloudPart, valueChainPart, mindmapPart, quadrantPart, chevronPart, cyclePart, stateDiagramPart, ganttPart, vennPart, tablePart, journeyMapPart, raciPart, swimlanePart, sequencePart];
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
