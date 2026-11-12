// The PPTX writer behind "svg-diagram/pptx/edge": a spec and a text engine in, a .pptx out, with nothing a Worker lacks.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {build as bundle} from 'esbuild';
import {closeMeasurer} from '../lib/dsl.ts';
import {partCatalog} from '../lib/spec.ts';
import {renderPptxEdge, TextEngineError} from '../lib/pptx-edge.ts';
import {rasterizeWithResvg} from '../lib/raster.ts';
import {xmlProblems} from '../lib/xml-check.ts';
import {realEngine} from './helpers/text-engine.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';

test.after(() => closeMeasurer());
const ROOT = path.resolve(import.meta.dirname, '..');
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const example = (type: string) => partCatalog().find(p => p.type === type)?.example;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const entry = (pptx: Uint8Array, name: string) => unzipEntry(Buffer.from(pptx), name).toString();

test('the entry reaches no node: module, directly or through what it imports', async () => {
  const out = await bundle({entryPoints: [path.join(ROOT, 'lib/pptx-edge.ts')], bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', logLevel: 'silent'});
  const imports = Object.values(out.metafile.outputs).flatMap(o => o.imports.map(i => i.path));
  assert.deepEqual(imports.filter(i => i.startsWith('node:')), []);
});

test('a table becomes a native table, a Venn diagram a picture whose text is outlines, with a PNG from the function handed in', async () => {
  const seen: {svg: string; scale: number}[] = [];
  const rasterize = async (svg: string, scale: number) => { seen.push({svg, scale}); return (await rasterizeWithResvg(svg, {scale, png: true})).png as Buffer; };
  const r = await renderPptxEdge(spec(example('table'), example('venn')), realEngine(), {rasterize});
  assert.deepEqual(r.issues, []);
  assert.ok(r.pptx);
  assert.deepEqual([r.native, r.pictures], [1, 1]);
  const slide = entry(r.pptx, 'ppt/slides/slide1.xml');
  assert.deepEqual(xmlProblems(slide), []);
  assert.match(slide, /<a:tbl>/);
  assert.match(slide, /typeface="BIZ UDPGothic"/);
  assert.match(slide, /<p:pic>/);
  const svg = entry(r.pptx, 'ppt/media/image1.svg');
  assert.doesNotMatch(svg, /<text\b/);
  assert.match(svg, /<use href="#sd-glyph-/);
  assert.deepEqual([seen.length, seen[0]?.scale], [1, 2]);
  assert.doesNotMatch(seen[0]?.svg ?? '', /<text\b/);
  assert.deepEqual([...unzipEntry(Buffer.from(r.pptx), 'ppt/media/image1.png').subarray(0, 8)], [...PNG]);
  assert.match(entry(r.pptx, '[Content_Types].xml'), /Extension="svg"/);
});

test('the same spec gives the same bytes, and the font and PNG scale can be chosen', async () => {
  const rasterize = () => PNG;
  const engine = realEngine();
  const a = await renderPptxEdge(spec(example('flowchart')), engine, {rasterize}), b = await renderPptxEdge(spec(example('flowchart')), engine, {rasterize});
  assert.ok(a.pptx && b.pptx);
  assert.deepEqual(a.pptx, b.pptx);
  const scales: number[] = [];
  const c = await renderPptxEdge(spec(example('table')), engine, {rasterize: (_s, scale) => { scales.push(scale); return PNG; }, font: 'Meiryo', pngScale: 3});
  assert.match(entry(c.pptx!, 'ppt/slides/slide1.xml'), /typeface="Meiryo"/);
  await assert.rejects(renderPptxEdge(spec(example('table')), engine, {rasterize, pngScale: 0}), /pngScale/);
});

test('a bad spec or a figure past the height limit gives issues and no file; a failing engine is the engine\'s error', async () => {
  const engine = realEngine();
  const bad = await renderPptxEdge({version: 1, parts: [{type: 'nope'}]}, engine, {rasterize: () => PNG});
  assert.equal(bad.pptx, null);
  assert.ok(bad.issues.length > 0);
  const tall = await renderPptxEdge(spec(example('table')), engine, {rasterize: () => PNG, maxHeight: 10});
  assert.equal(tall.pptx, null);
  assert.match(tall.issues[0]?.message ?? '', /limit is 10px/);
  const broken = {...engine, measure: () => { throw new Error('boom'); }};
  await assert.rejects(renderPptxEdge(spec(example('table')), broken, {rasterize: () => PNG}), TextEngineError);
});

test('every example of the catalog becomes a .pptx whose slide and pictures are well-formed', async () => {
  const engine = realEngine();
  for (const {type, example: ex} of partCatalog()) {
    const r = await renderPptxEdge(spec(ex), engine, {rasterize: () => PNG});
    assert.deepEqual(r.issues, [], type);
    assert.ok(r.pptx, type);
    assert.deepEqual(xmlProblems(entry(r.pptx, 'ppt/slides/slide1.xml')), [], type);
    for (let i = 1; i <= r.pictures; i++) {
      const svg = entry(r.pptx, `ppt/media/image${i}.svg`);
      assert.deepEqual(xmlProblems(svg), [], `${type} picture ${i}`);
      assert.doesNotMatch(svg, /<text\b/, `${type} picture ${i}`);
    }
  }
});

test('a tree is native shapes: one rounded box per node holding its text, and every line a connector glued to parent and child', async () => {
  const tree = {type: 'tree', root: {label: '目標', children: [{label: '施策 A', sub: '補足', children: [{label: '手順 1'}, {label: '手順 2'}]}, {label: '施策 B'}]}};
  const r = await renderPptxEdge(spec(tree), realEngine(), {rasterize: () => PNG});
  assert.equal(r.pictures, 0);
  const slide = entry(r.pptx!, 'ppt/slides/slide1.xml');
  assert.equal(slide.match(/prst="roundRect"/g)?.length, 5);
  assert.equal(slide.match(/<p:cxnSp>/g)?.length, 4);
  assert.equal(slide.match(/<a:stCxn /g)?.length, 4);
  assert.equal(slide.match(/<a:endCxn /g)?.length, 4);
  for (const label of ['目標', '施策 A', '補足', '手順 2']) assert.match(slide, new RegExp(`<a:t>${label}</a:t>`));
  assert.deepEqual(xmlProblems(slide), []);
});

test('a mind map with curved edges draws them as curved connectors, and a fishbone is shapes too, its slanted bones straight connectors', async () => {
  const engine = realEngine();
  const mind = (layout: string, more: object = {}) => ({type: 'mindmap', layout, ...more, root: {label: '中心', children: [{label: '枝 1', children: [{label: '葉 1'}, {label: '葉 2'}]}, {label: '枝 2'}, {label: '枝 3'}]}});
  const curved = entry((await renderPptxEdge(spec(mind('right', {edges: 'curve'})), engine, {rasterize: () => PNG})).pptx!, 'ppt/slides/slide1.xml');
  assert.match(curved, /prst="curvedConnector3"/);
  const fish = await renderPptxEdge(spec(mind('fishbone')), engine, {rasterize: () => PNG});
  assert.equal(fish.pictures, 0);
  const bones = entry(fish.pptx!, 'ppt/slides/slide1.xml');
  assert.match(bones, /<a:xfrm flipV="1">(?:(?!<\/p:cxnSp>).)*prst="straightConnector1"/);
  assert.match(bones, /<a:ln w="38100">/); // the spine
});

test('nodeRunsOf: a node\'s lines become runs at the layout\'s baselines, coloured as the svg colours them', async () => {
  const {nodeRunsOf} = await import('../lib/pptx/tree.ts');
  const {NO_TONES} = await import('../lib/tokens.ts');
  const node = {x: 0, y: 0, w: 100, h: 50, tone: 'plain' as const};
  const texts = [{text: '見出し', x: 50, y: 22, size: 14, bold: true, muted: false}, {text: '補足', x: 50, y: 40, size: 12, bold: false, muted: true}, {text: '外', x: 500, y: 40, size: 12, bold: false, muted: false}];
  const runs = nodeRunsOf(node as never, texts, NO_TONES);
  assert.deepEqual(runs.map(r => [r.lines, r.lineYs, r.weight, r.tone]), [[['見出し'], [14], 700, undefined], [['補足'], [32], 400, 'muted']]);
  // white on a solid fill, the second line too
  assert.equal(nodeRunsOf({...node, tone: 'solid'} as never, texts, NO_TONES)[1]?.tone, undefined);
});

test('the shape writers of the tree: a glued connector of a given colour and width, and an open freeform with curves', async () => {
  const {connectorShapeXml, freeformPathXml} = await import('../lib/pptx/connectors.ts');
  const c = connectorShapeXml(7, 'line', {prst: 'curvedConnector3', offX: 0, offY: 0, extX: 100, extY: 50, rot: 0, flipH: false, flipV: true, adj: [50000]}, '#123456', 4, {id: 2, idx: 3}, {id: 3, idx: 1});
  assert.match(c, /<a:stCxn id="2" idx="3"\/><a:endCxn id="3" idx="1"\/>/);
  assert.match(c, /flipV="1"[\s\S]*prst="curvedConnector3"[\s\S]*<a:ln w="38100"><a:solidFill><a:srgbClr val="123456"/);
  const f = freeformPathXml(8, 'brace', [{op: 'M', pts: [{x: 10, y: 10}]}, {op: 'Q', pts: [{x: 20, y: 10}, {x: 20, y: 30}]}], '#000000', 2);
  assert.match(f, /<a:off x="95250" y="95250"\/><a:ext cx="95250" cy="190500"\/>/);
  assert.match(f, /<a:path w="95250" h="190500" fill="none"><a:moveTo><a:pt x="0" y="0"\/><\/a:moveTo><a:quadBezTo><a:pt x="95250" y="0"\/><a:pt x="95250" y="190500"\/><\/a:quadBezTo>/);
  assert.deepEqual(xmlProblems(`<r xmlns:a="a" xmlns:p="p">${c}${f}</r>`), []);
});

test('treeXml numbers its shapes from the counter it is given and reports the nodes connect() can reach', async () => {
  const {treeXml} = await import('../lib/pptx/tree.ts');
  const {NO_TONES} = await import('../lib/tokens.ts');
  const band = {type: 'tree', x: 0, y: 0, w: 200, h: 100, nodes: [{x: 0, y: 0, w: 60, h: 30, tone: 'plain', id: 'a'}, {x: 100, y: 0, w: 60, h: 30, tone: 'plain'}], edges: [{points: [{x: 60, y: 15}, {x: 100, y: 15}]}], texts: [], anchors: [], labelBoxes: []};
  let n = 10;
  const r = treeXml(band as never, {day: 'blue'} as never, NO_TONES, {sans: 'S', mono: 'M'}, () => ++n);
  assert.deepEqual(r.glue, [{dslId: 'a', id: 11, rect: {x: 0, y: 0, w: 60, h: 30}}]);
  assert.match(r.xml, /<a:stCxn id="11" idx="3"\/><a:endCxn id="12" idx="1"\/>/);
  assert.match(r.xml, /^<p:grpSp><p:nvGrpSpPr><p:cNvPr id="14" name="tree"\/>/);
});

test('a quadrant is native shapes: cells, items as their markers, and every label a text box of its own', async () => {
  const r = await renderPptxEdge(spec(example('quadrant')), realEngine(), {rasterize: () => PNG});
  assert.equal(r.pictures, 0);
  const slide = entry(r.pptx!, 'ppt/slides/slide1.xml');
  assert.match(slide, /prst="ellipse"|prst="rect"|prst="diamond"|prst="triangle"/);
  assert.match(slide, /<a:bodyPr wrap="none"/);
  assert.deepEqual(xmlProblems(slide), []);
});

test('markerShape: each marker has the area the svg gives it, centred where the svg centres it', async () => {
  const {markerShape} = await import('../lib/pptx/quadrant.ts');
  const area = Math.PI * 10 * 10;
  const circle = markerShape('circle', 50, 50, 10).rect, square = markerShape('square', 50, 50, 10).rect, diamond = markerShape('diamond', 50, 50, 10).rect;
  assert.deepEqual(circle, {x: 40, y: 40, w: 20, h: 20});
  assert.ok(Math.abs(square.w * square.h - area) < 1e-9);
  assert.ok(Math.abs(diamond.w * diamond.h / 2 - area) < 1e-9);
  const t = markerShape('triangle', 50, 50, 10);
  assert.equal(t.prst, 'triangle');
  assert.ok(Math.abs(t.rect.w * t.rect.h / 2 - area) < 1e-9);
  assert.ok(Math.abs(t.rect.y + t.rect.h * 2 / 3 - 50) < 1e-9); // the centroid is at the point
});

test('the plain pieces: a text line sits on its baseline at its anchor, presets and polygons carry their paint, a line its arrow', async () => {
  const {textLineXml, presetXml, polygonXml, lineXml, nameOf} = await import('../lib/pptx/prims.ts');
  const {quadrantXml} = await import('../lib/pptx/quadrant.ts');
  const fonts = {sans: 'S', mono: 'M'};
  const t = textLineXml(2, 'n', {text: 'ab', x: 100, y: 50, anchor: 'end', size: 10, bold: true, color: '#112233'}, fonts);
  // 14px pitch, the baseline at 0.8 of it: the box's top is 50 - 11.2; its right edge is at the anchor
  assert.match(t, /<a:off x="(\d+)" y="369570"\/><a:ext cx="(\d+)" cy="133350"\/>/);
  const [, ox, cx] = /<a:off x="(\d+)"[^>]*\/><a:ext cx="(\d+)"/.exec(t) ?? [];
  assert.equal(Number(ox) + Number(cx), 952500);
  assert.match(t, /algn="r"[\s\S]*b="1"[\s\S]*<a:srgbClr val="112233"\/>[\s\S]*<a:t>ab<\/a:t>/);
  assert.match(presetXml(3, 'p', 'roundRect', {x: 0, y: 0, w: 10, h: 10}, {fill: '#ffffff', stroke: '#000000', dashed: true}, 8000), /prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 8000"\/>[\s\S]*FFFFFF[\s\S]*<a:prstDash val="dash"\/>/);
  assert.match(polygonXml(4, 'g', [{x: 0, y: 0}, {x: 10, y: 0}, {x: 5, y: 8}], {fill: '#ff0000'}), /<a:close\/><\/a:path>[\s\S]*FF0000[\s\S]*<a:ln><a:noFill\/><\/a:ln>/);
  assert.match(lineXml(5, 'l', {x: 0, y: 0}, {x: 30, y: 40}, '#000000', 2, {arrow: true, dashed: true}), /straightConnector1[\s\S]*<a:prstDash val="dash"\/><a:tailEnd type="triangle"/);
  assert.equal(nameOf('item', 7, 'クラウド'), 'item: クラウド');
  assert.equal(nameOf('cell', 7), 'cell-7');
  const band = {type: 'quadrant', x: 0, y: 0, w: 100, h: 100, plot: {x: 0, y: 0, w: 100, h: 100}, crosshair: true, cells: [], regions: [], lines: [], texts: [], bubbles: [{x: 50, y: 50, r: 5, cr: 5, shape: 'circle', tone: 'accent', hollow: false, cell: 0, id: 'a', label: 'A'}], arrows: [], chips: [], marks: [], anchors: [], labelBoxes: [], moved: [], floored: [], emptyCells: []};
  let n = 0;
  const q = quadrantXml(band as never, {day: 'blue'} as never, (await import('../lib/tokens.ts')).NO_TONES, fonts, () => ++n);
  assert.deepEqual(q.glue, [{dslId: 'a', id: 1, rect: {x: 45, y: 45, w: 10, h: 10}}]);
});
