import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderSpec, partCatalog, specSchemaFor, validateSpec} from '../lib/spec-selective.ts';
import {flowchartPart} from '../lib/spec-parts/selective/flowchart.ts';
import {funnelPart} from '../lib/spec-parts/selective/funnel.ts';
import {pyramidPart} from '../lib/spec-parts/selective/pyramid.ts';
import {partCatalog as legacyCatalog, specToDiagram} from '../lib/spec.ts';
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
  assert.equal(validateSpec({...input, canvas: {}}, {parts})[0]!.path, 'canvas');
  const dup = validateSpec({...input, parts: [flowchartPart.example, flowchartPart.example]}, {parts});
  assert.equal(dup[0]!.path, 'parts[1].nodes[0].id');
});

test('the selected schema rejects duplicates and validation keywords it cannot enforce', () => {
  assert.throws(() => specSchemaFor({parts: [funnelPart, funnelPart]}), /duplicate part "funnel"/);
  const properties = {...pyramidPart.schema.properties, caption: {type: 'string' as const, pattern: '^a$'}};
  assert.throws(() => specSchemaFor({parts: [{...pyramidPart, schema: {...pyramidPart.schema, properties}}]}),
    /unsupported schema keyword "pattern" at pyramid.properties.caption/);
});

const moreParts = [histogramPart, scatterPart, controlChartPart, checkSheetPart, rangeBarsPart, boxplotPart, qfdPart, whyWhyTablePart, concentricPart, harveyPart, comparePart, mekkoPart, butterflyPart, comboPart, barsPart, linesPart, stackedBarsPart, waterfallPart, radarPart, paretoPart, sankeyPart, treemapPart, heatmapPart, bubblePart, tornadoPart, strategyCanvasPart, bpmnPart, classDiagramPart, pertPart, timelinePart, treePart, dependencyNetworkPart, causeTreePart, cloudPart, valueChainPart, mindmapPart, quadrantPart, chevronPart, cyclePart, stateDiagramPart, ganttPart, vennPart, tablePart, journeyMapPart, raciPart, swimlanePart, sequencePart];
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
