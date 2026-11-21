import assert from 'node:assert/strict';
import test from 'node:test';
import {closeMeasurer, renderDiagram} from '../lib/dsl.ts';
import {renderDeckPptxEdge} from '../lib/pptx-deck-edge.ts';
import {walkBands} from '../lib/rules.ts';
import {captureSourceLocations, sourceOf} from '../lib/source-ref.ts';
import {renderSpecEdge} from '../lib/spec-edge.ts';
import {renderSpec} from '../lib/spec-render.ts';
import {layoutIssue, specToDiagram, validateSpec} from '../lib/spec.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';

test.after(() => closeMeasurer());

const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const lane = (prefix: string, col: number, colGap = 28) => ({
  type: 'swimlane',
  lanes: [{id: 'a', label: '担当'}],
  steps: [{id: `${prefix}1`, lane: 'a', title: '共有', col: 1}, {id: `${prefix}2`, lane: 'a', title: '確認', col}],
  colGap,
});
const config = {measure: 'font', fonts: JA_FONTS} as const;

test('a spec overlap between repeated headings points to the field in the overlapping part', async () => {
  const figure = spec(lane('a', 2), lane('b', 1));
  const node = await renderSpec(figure, {config});
  const edge = await renderSpecEdge(figure, realEngine());
  for (const result of [node, edge]) {
    assert.deepEqual(result.issues, []);
    const overlaps = result.problems.filter(p => /^"共有" overlaps "確認"/.test(p.message));
    assert.deepEqual(overlaps.map(p => p.path), ['parts[1].steps[0].title']);
  }
});

test('a stamped spec problem keeps the field path of a unique heading', async () => {
  const figure = spec(lane('b', 1));
  const result = await renderSpec(figure, {config});
  const overlap = result.problems.find(p => /^"共有" overlaps "確認"/.test(p.message));
  assert.equal(overlap?.path, 'parts[0].steps[0].title');
});

test('a stamped board connector problem still points to the link', async () => {
  const figure = spec(
    {type: 'board', nodes: [{id: 'other', title: '共有'}]},
    {
      type: 'board',
      nodes: [{id: 'a', title: '開始'}, {id: 'b', title: '共有'}, {id: 'c', title: '終了'}],
      links: [{from: 'a', to: 'c'}],
    },
  );
  const result = await renderSpec(figure, {config});
  assert.deepEqual(result.issues, []);
  const overlap = result.problems.find(p => p.message.includes('path overlaps "共有"'));
  assert.equal(overlap?.path, 'parts[1].links[0]');
});

test('a layout error for an unknown anchor uses the marked part when the name is repeated', async () => {
  const first = lane('a', 2);
  const second = {...lane('b', 2), flows: [{from: 'b1', to: 'b2'}]};
  const figure = spec(first, second);
  const diagram = specToDiagram(figure);
  // Spec validation catches dangling references. Introduce one in the built connector to exercise the layout throw.
  const connector = diagram.bands.find(b => b.type === 'connect');
  assert.ok(connector);
  connector.to = '共有:left';
  await assert.rejects(renderDiagram(diagram, {name: 'x.svg', budget: 'cacheOnly'}), (error: Error) => {
    assert.match(error.message, /unknown anchor id "共有"/);
    assert.equal(layoutIssue(figure, error).path, 'parts[1].steps[0].title');
    return true;
  });
});

test('a thrown spec layout error keeps its part under both deck figure prefixes', async () => {
  const figure = spec(lane('a', 2), lane('b', 8, 96));
  assert.deepEqual(validateSpec(figure), []);
  const node = await renderSpec(figure, {config});
  const engine = realEngine();
  const edge = await renderSpecEdge(figure, engine);
  const deck = await renderDeckPptxEdge({slides: [
    {title: '表紙'},
    {figure},
    {columns: [{text: '説明'}, {figure}]},
  ]}, engine, {rasterize: () => new Uint8Array()});
  assert.deepEqual(node.issues.map(i => i.path), ['parts[1]']);
  assert.deepEqual(edge.issues, node.issues);
  assert.deepEqual(deck.issues.map(i => i.path), ['slides[1].figure.parts[1]', 'slides[2].columns[1].figure.parts[1]']);
});

test('spec marks cover all returned and nested bands with stack capture off or on', () => {
  const figure = spec(lane('a', 2), {...lane('b', 2), flows: [{from: 'b1', to: 'b2'}]});
  for (const on of [false, true]) {
    captureSourceLocations(on);
    try {
      const {bands} = specToDiagram(figure);
      assert.deepEqual(bands.map(b => b.type), ['swimlane', 'swimlane', 'connect']);
      for (const [i, band] of bands.entries()) {
        const ref = sourceOf(band);
        assert.equal(ref?.specPath, i === 0 ? 'parts[0]' : 'parts[1]');
        assert.equal(ref?.stackHolder, undefined);
        for (const nested of walkBands([band])) assert.equal(sourceOf(nested), ref);
      }
      const [, block, connector] = bands;
      assert.ok(block && connector);
      assert.equal(sourceOf(block), sourceOf(connector));
    } finally {
      captureSourceLocations(false);
    }
  }
});
