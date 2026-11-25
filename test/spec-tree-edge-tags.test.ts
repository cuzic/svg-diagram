// ADR 0081 U3 (D7): a mind map's items take `edge` and `tags` in a spec. It draws what the DSL draws, the errors the schema cannot say come
// back with the place in the spec, and no other part's tree gets the fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import {closeMeasurer, diagram, mindmap, renderDiagram} from '../lib/dsl.ts';
import {MAX_TREE_DEPTH, treeItem} from '../lib/spec-kit.ts';
import {partCatalog, specToDiagram, validateSpec} from '../lib/spec.ts';
import {validateSpec as validateSelective, partCatalog as selectiveCatalog, renderSpec} from '../lib/spec-selective.ts';
import {mindmapPart} from '../lib/spec-parts/selective/mindmap.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const svgOf = async (d: Diagram) => (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (part: Record<string, unknown>) => ({version: 1, title: '例', parts: [{type: 'mindmap', ...part}]});
const issues = (part: Record<string, unknown>) => validateSpec(spec(part)).map(i => `${i.path}: ${i.message}`);
const root = {label: '新店', children: [
  {label: '賛成', edge: {tone: 'accent'}, tags: ['採用', {text: '要確認', tone: 'danger'}], children: [{label: '立地がよい', edge: {line: 'dotted'}}]},
  {label: '反対', edge: {tone: 'danger', line: 'dashed'}},
]};

test('a mind map spec with edge and tags draws the same SVG as the DSL', async () => {
  const dsl = diagram({theme: 'blue', title: '例'}).add(mindmap(root as never, {layout: 'right'}));
  const json = specToDiagram(spec({root, layout: 'right'}));
  assert.deepEqual(validateSpec(spec({root, layout: 'right'})), []);
  const svg = await svgOf(json);
  assert.equal(svg, await svgOf(dsl as unknown as Diagram));
  assert.match(svg, /stroke-dasharray="6,4"/);
  assert.match(svg, /要確認/);
});

test('the selective mindmap entry takes edge and tags and draws them', async () => {
  const input = spec({root, layout: 'right'});
  assert.deepEqual(validateSelective(input, {parts: [mindmapPart]}), []);
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const r = await renderSpec(input, {parts: [mindmapPart], measure});
  assert.deepEqual(r.xml, []);
  assert.match(r.svg, /要確認/);
  assert.deepEqual(selectiveCatalog({parts: [mindmapPart]}), partCatalog().filter(p => p.type === 'mindmap'));
  assert.match(validateSelective(spec({layout: 'brace', root: {label: 'a', children: [{label: 'b', edge: {}}]}}), {parts: [mindmapPart]})[0]!.path, /^parts\[0\]\.root\.children\[0\]\.edge$/);
});

test('the catalog example of a mind map shows pros and cons edges and a tag', () => {
  const ex = partCatalog().find(p => p.type === 'mindmap')!.example;
  assert.deepEqual(validateSpec({version: 1, title: '例', parts: [ex]}), []);
  const text = JSON.stringify(ex);
  assert.match(text, /"edge":\{"tone":"accent"\}/);
  assert.match(text, /"tone":"danger","line":"dashed"/);
  assert.match(text, /"tags"/);
});

test('edge and tags errors say where they are', () => {
  const at = 'parts[0].root.children[0]';
  const one = (child: Record<string, unknown>, extra: Record<string, unknown> = {}) => issues({...extra, root: {label: 'r', children: [{label: 'c', ...child}]}});
  assert.deepEqual(issues({root: {label: 'r', edge: {tone: 'accent'}}}).map(s => s.split(':')[0]), ['parts[0].root.edge']);
  // the root takes no edge: the schema says so (one source of truth), with the known fields in the message
  assert.match(issues({root: {label: 'r', edge: {}}})[0]!, /^parts\[0\]\.root\.edge: is not a known field \(known: .*tags/);
  assert.match(one({edge: {}}, {edges: false})[0]!, new RegExp(`^${at.replace(/[[\]]/g, '\\$&')}\\.edge: .*edges: false`));
  for (const layout of ['brace', 'fishbone', 'timeline']) assert.match(one({edge: {line: 'dashed'}}, {layout})[0]!, new RegExp(`\\.children\\[0\\]\\.edge: .*layout: '${layout}' では使えません`));
  for (const layout of ['radial', 'right', 'left', 'down', 'up', 'org', 'list']) assert.deepEqual(one({edge: {}}, {layout}), [], layout);
  assert.match(one({tags: ['東京タワー・スカイツリー展']})[0]!, /^parts\[0\]\.root\.children\[0\]\.tags\[0\]: 札「.*」は 13 文字です/);
  // a blank tag: the schema's message is what the user gets (the part's check() does not run when the schema has issues)
  assert.deepEqual(one({tags: ['  ']}), [`${at}.tags[0]: must not be empty`]);
  assert.deepEqual(one({tags: [{text: '　', tone: 'accent'}]}), [`${at}.tags[0].text: must not be empty`]);
  assert.match(one({tags: ['ok', {text: '　 ', tone: 'accent'}]})[0]!, /^parts\[0\]\.root\.children\[0\]\.tags\[1\]\.text: /);
  assert.deepEqual(one({tags: ['あいうえおかきく', '😀😀😀😀😀😀😀😀', 'abc']}), []);
  assert.match(one({tags: ['a', 'b', 'c', 'd']})[0]!, /^parts\[0\]\.root\.children\[0\]\.tags: /);
  assert.match(one({edge: {tone: 'plain'}})[0]!, /\.edge\.tone/);
  assert.match(one({edge: {color: 'red'}})[0]!, /\.edge\.color/);
  assert.match(one({tags: [{text: 'x', tone: 'solid'}]})[0]!, /\.tags\[0\]\.tone/);
  assert.match(one({tags: ['x'.repeat(17)]})[0]!, /\.tags\[0\]/);
  // a deep item is located too
  const deep = {label: 'r', children: [{label: 'a', children: [{label: 'b', tags: ['123456789']}]}]};
  assert.equal(validateSpec(spec({root: deep}))[0]!.path, 'parts[0].root.children[0].children[0].tags[0]');
});

test('the schema of other parts does not change: only a mind map takes edge and tags', () => {
  const tree = partCatalog().find(p => p.type === 'tree')!;
  assert.deepEqual(tree.schema.properties?.['root'], treeItem(MAX_TREE_DEPTH));
  assert.doesNotMatch(JSON.stringify(tree), /"edge"|"tags"/);
  assert.match(JSON.stringify(partCatalog().find(p => p.type === 'mindmap')!.schema), /"edge".*"tags"/);
  assert.match(JSON.stringify(partCatalog().find(p => p.type === 'mindmap')!.schema), /"maxLength":16/);
  const bad = validateSpec({version: 1, title: '例', parts: [{type: 'tree', root: {label: 'r', children: [{label: 'c', edge: {}}]}}]})[0]!;
  assert.equal(bad.path, 'parts[0].root.children[0].edge');
});
