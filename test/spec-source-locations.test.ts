import assert from 'node:assert/strict';
import test from 'node:test';
import {closeMeasurer, renderDiagram} from '../lib/dsl.ts';
import {renderDeckPptxEdge} from '../lib/pptx-deck-edge.ts';
import {walkAnyBands as walkBands} from '../lib/full-definitions.ts';
import {captureSourceLocations, sourceOf} from '../lib/source-ref.ts';
import {renderSpecEdge} from '../lib/spec-edge.ts';
import {renderSpec} from '../lib/spec-render.ts';
import {layoutIssue, partCatalog, specToDiagram, validateSpec} from '../lib/spec.ts';
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

const longHeading = '同じ見出し'.repeat(10);
const boardWithHeading = (id: string, title: string) => ({
  type: 'board', nodes: [{id, kind: 'group', title, children: [{title: '説明'}]}],
});

test('warnings for repeated long headings point to their respective spec parts', async () => {
  const figure = {...spec(boardWithHeading('a', longHeading), boardWithHeading('b', longHeading)), width: 320};
  for (const result of [await renderSpec(figure, {config}), await renderSpecEdge(figure, realEngine())]) {
    assert.deepEqual(result.issues, []);
    const warnings = result.findings.filter(f => f.rule === 'cjk-line-long');
    assert.deepEqual(warnings.map(f => f.path), ['parts[0].nodes[0].title', 'parts[1].nodes[0].title']);
    assert.equal(warnings[0]?.message, warnings[1]?.message);
  }
});

test('a stamped spec warning keeps the field path of a unique heading', async () => {
  const figure = {...spec(boardWithHeading('a', '短い見出し'), boardWithHeading('b', longHeading)), width: 320};
  const result = await renderSpec(figure, {config});
  assert.deepEqual(result.findings.filter(f => f.rule === 'cjk-line-long').map(f => f.path), ['parts[1].nodes[0].title']);
});

test('a grouped spec warning locates a field in a related part', async t => {
  const examples = new Map(partCatalog().map(({type, example}) => [type, example]));
  const figure = {...spec(examples.get('matrix'), examples.get('table')), width: 320};
  const node = await renderSpec(figure, {config});
  const edge = await renderSpecEdge(figure, realEngine());
  for (const [engine, result] of Object.entries({node, edge})) {
    await t.test(engine, () => {
      assert.deepEqual(result.issues, []);
      assert.deepEqual(result.findings.filter(f => f.rule === 'text-mid-word-break').map(f => f.path), ['parts[1].columns[2].label']);
    });
  }
});

test('a grouped spec warning skips a part with multiple field matches', async t => {
  // The glyph matches two titles in the first board and one in the second.
  const figure = spec(
    {type: 'board', nodes: [{id: 'a', title: '✅'}, {id: 'b', title: '✅'}]},
    {type: 'board', nodes: [{id: 'c', title: '✅'}]},
  );
  const node = await renderSpec(figure, {config});
  const edge = await renderSpecEdge(figure, realEngine());
  for (const [engine, result] of Object.entries({node, edge})) {
    await t.test(engine, () => {
      assert.deepEqual(result.issues, []);
      assert.deepEqual(result.findings.filter(f => f.rule === 'glyph-missing').map(f => f.path), ['parts[1].nodes[0].title']);
    });
  }
});

test('a grouped spec warning falls back to the first affected part when it names no field', async () => {
  const chain = (...ids: string[]) => ({
    type: 'board', nodes: ids.map(id => ({id, title: id})), links: ids.slice(1).map((to, i) => ({from: ids[i], to})),
  });
  // The largest component is b → c → d. The warning groups the two smaller components.
  const figure = spec(chain('note'), chain('a1', 'a2'), chain('b', 'c', 'd'), chain('e1', 'e2'));
  for (const result of [await renderSpec(figure, {config}), await renderSpecEdge(figure, realEngine())]) {
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.findings.filter(f => f.rule === 'graph-disconnected').map(f => f.path), ['parts[1]']);
  }
});

test('linkOf keeps the original part index when locating a stamped board connector', async () => {
  // Anchor IDs are unique across boards, so narrowing cannot disambiguate a board link.
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

test('spec marks cover all returned and nested bands and keep captured stacks', () => {
  const figure = spec(lane('a', 2), {...lane('b', 2), flows: [{from: 'b1', to: 'b2'}]});
  for (const on of [false, true]) {
    captureSourceLocations(on);
    try {
      const {bands} = specToDiagram(figure);
      assert.deepEqual(bands.map(b => b.type), ['swimlane', 'swimlane', 'connect']);
      for (const [i, band] of bands.entries()) {
        const ref = sourceOf(band);
        assert.equal(ref?.specPath, i === 0 ? 'parts[0]' : 'parts[1]');
        if (on) assert.match(ref?.stackHolder?.stack ?? '', /spec-source-locations\.test\.ts/);
        else assert.equal(ref?.stackHolder, undefined);
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

test('a spec mark keeps each board child’s own captured stack', t => {
  captureSourceLocations(true);
  t.after(() => captureSourceLocations(false));
  const {bands} = specToDiagram(spec({type: 'board', nodes: [{id: 'a', title: '開始'}, {id: 'b', title: '終了'}]}));
  const [board, ...children] = walkBands(bands);
  assert.ok(board);
  assert.equal(children.length, 2);
  for (const child of children) {
    const ref = sourceOf(child);
    assert.equal(ref?.specPath, 'parts[0]');
    assert.ok(ref.stackHolder);
    assert.notEqual(ref.stackHolder, sourceOf(board)?.stackHolder);
  }
});
