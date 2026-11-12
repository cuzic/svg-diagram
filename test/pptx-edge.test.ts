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

test('a flowchart is native shapes: a diamond holds its question, every arrow is glued at both ends, a label sits on a chip', async () => {
  const r = await renderPptxEdge(spec(example('flowchart')), realEngine(), {rasterize: () => PNG});
  assert.equal(r.pictures, 0);
  const slide = entry(r.pptx!, 'ppt/slides/slide1.xml');
  const arrows = slide.split('<p:cxnSp>').slice(1);
  assert.ok(arrows.length > 0);
  for (const a of arrows) { assert.match(a, /<a:stCxn /); assert.match(a, /<a:endCxn /); assert.match(a, /<a:tailEnd type="triangle"/); }
  // a diamond: its own geometry, with the four sites a connector glues to, and its text inside it
  assert.match(slide, /<a:cxnLst><a:cxn ang="16200000">[\s\S]*?<a:lnTo>[\s\S]*?<a:t>/);
  assert.deepEqual(xmlProblems(slide), []);
});

test('a state diagram glues its start dot, draws an end state\'s inner frame, and names no shape with a control character', async () => {
  const states = {type: 'stateDiagram', initial: 'a', states: [{id: 'a', label: '受付'}, {id: 'b', label: '完了', final: true, tone: 'accent'}], transitions: [{from: 'a', to: 'b', label: '処理'}]};
  const r = await renderPptxEdge(spec(states), realEngine(), {rasterize: () => PNG});
  assert.equal(r.pictures, 0);
  const slide = entry(r.pptx!, 'ppt/slides/slide1.xml');
  assert.equal(slide.match(/<a:stCxn /g)?.length, 2);
  assert.match(slide, /name="end-b"/);
  assert.doesNotMatch(slide, /[\u0000-\u0008]/);
  assert.match(slide, /<a:t>完了<\/a:t>/);
  assert.deepEqual(xmlProblems(slide), []);
});

test('roundGeomXml: the whole box is the text area, the sites are top, left, bottom, right; geomShapeXml paints it', async () => {
  const {roundGeomXml, geomShapeXml} = await import('../lib/pptx/prims.ts');
  for (const kind of ['diamond', 'ellipse', 'pill'] as const) {
    const g = roundGeomXml(kind, 100, 40);
    assert.match(g, /<a:rect l="l" t="t" r="r" b="b"\/>/);
    assert.match(g, /<a:cxn ang="16200000"><a:pos x="476250" y="0"\/><\/a:cxn><a:cxn ang="10800000"><a:pos x="0" y="190500"\/><\/a:cxn><a:cxn ang="5400000"><a:pos x="476250" y="381000"\/><\/a:cxn><a:cxn ang="0"><a:pos x="952500" y="190500"\/><\/a:cxn>/);
  }
  assert.match(roundGeomXml('pill', 100, 40), /<a:arcTo wR="190500" hR="190500" stAng="16200000" swAng="10800000"\/>/);
  assert.match(geomShapeXml(2, 'dot', {x: 0, y: 0, w: 10, h: 10}, roundGeomXml('ellipse', 10, 10), {fill: '#000000'}), /<a:custGeom>[\s\S]*<a:solidFill><a:srgbClr val="000000"\/><\/a:solidFill><a:ln><a:noFill\/><\/a:ln>/);
});

test('statesXml reports each node by its DSL id, and a node line takes its tone\'s text colour', async () => {
  const {statesXml} = await import('../lib/pptx/states.ts');
  const {nodeRunsOf} = await import('../lib/pptx/tree.ts');
  const {NO_TONES} = await import('../lib/tokens.ts');
  const band = {type: 'states', x: 0, y: 0, w: 200, h: 60, nodes: [{x: 0, y: 0, w: 60, h: 30, tone: 'plain'}, {x: 100, y: 0, w: 60, h: 30, tone: 'accent', shape: 'diamond'}], edges: [{from: 's', to: 't', points: [{x: 60, y: 15}, {x: 100, y: 15}], line: 'solid'}], texts: [], icons: [], labels: [], anchors: [{id: 's', x: 0, y: 0, w: 60, h: 30}, {id: 't', x: 100, y: 0, w: 60, h: 30}], labelBoxes: []};
  let n = 0;
  const r = statesXml(band as never, {day: 'blue'} as never, NO_TONES, {sans: 'S', mono: 'M'}, () => ++n);
  assert.deepEqual(r.glue.map(g => [g.dslId, g.id]), [['s', 1], ['t', 2]]);
  assert.match(r.xml, /<a:stCxn id="1" idx="3"\/><a:endCxn id="2" idx="1"\/>/);
  const runs = nodeRunsOf({x: 0, y: 0, w: 60, h: 30, tone: 'accent'}, [{text: 'A', x: 30, y: 20, size: 14, bold: true, muted: false}], NO_TONES);
  assert.equal(runs[0]?.tone, 'accent');
});

test('a cause tree is native shapes: every arrow glued to cause and effect', async () => {
  const r = await renderPptxEdge(spec(example('causeTree')), realEngine(), {rasterize: () => PNG});
  assert.equal(r.pictures, 0);
  const slide = entry(r.pptx!, 'ppt/slides/slide1.xml');
  const arrows = slide.split('<p:cxnSp>').slice(1).filter(c => /name="arrow-/.test(c));
  assert.ok(arrows.length > 0);
  for (const a of arrows) { assert.match(a, /<a:stCxn /); assert.match(a, /<a:endCxn /); }
  assert.deepEqual(xmlProblems(slide), []);
});

test('a cutting arrow has no head and is not glued to what it cuts: it ends in a bar', async () => {
  const tree = {type: 'causeTree', tree: 'crt', coreDriver: true, nodes: [{id: 'u', label: '遅れる', role: 'ude'}, {id: 'r', label: '評価の仕組み', role: 'root'}, {id: 't', label: '枠を見直す', role: 'trim'}], links: [{from: 'r', to: 'u'}, {from: 't', to: 'u', kind: 'blocks'}]};
  const slide = entry((await renderPptxEdge(spec(tree), realEngine(), {rasterize: () => PNG})).pptx!, 'ppt/slides/slide1.xml');
  const cut = slide.split('<p:cxnSp>').find(c => /name="arrow-t-u"/.test(c)) ?? '';
  assert.doesNotMatch(cut, /tailEnd|<a:endCxn/);
  assert.match(slide, /name="bar-t-u"/);
  assert.deepEqual(xmlProblems(slide), []);
});

test('coreBadgeRect and focusColor follow the svg: the badge away from the leaving arrow, lit arrows in the accent colour', async () => {
  const {coreBadgeRect, focusColor} = await import('../lib/pptx/cause.ts');
  const n = {x: 100, y: 100, w: 80, h: 40};
  assert.deepEqual(coreBadgeRect(n, {x: 140, y: 100}), {x: 106, y: 142, w: 44, h: 22}); // leaves at the top: the badge below
  assert.deepEqual(coreBadgeRect(n, undefined), {x: 106, y: 76, w: 44, h: 22});
  const ink = focusColor(['a'], 'blue', '#000000');
  assert.notEqual(ink('a', 'b'), ink('c', 'd'));
  assert.equal(focusColor(undefined, 'blue', '#000000')('a', 'b'), '#000000');
});

test('a legend with fault-tree symbols stays a picture; causeXml and legendXml report what connect() can reach', async () => {
  const {legendNative, legendXml} = await import('../lib/pptx/legend.ts');
  const {causeXml} = await import('../lib/pptx/cause.ts');
  const {NO_TONES} = await import('../lib/tokens.ts');
  assert.equal(legendNative({type: 'legend', x: 0, y: 0, w: 1, h: 1, items: [{label: 'x', ftaEvent: 'basic', textW: 1, w: 1, x: 0, y: 0}]} as never), false);
  assert.equal(legendNative({type: 'legend', x: 0, y: 0, w: 1, h: 1, items: [{label: 'x', edge: 'and', textW: 1, w: 1, x: 0, y: 0}]} as never), true);
  let n = 0;
  const ld = {day: 'blue', roles: {note: 12}} as never;
  assert.match(legendXml({type: 'legend', x: 0, y: 0, w: 100, h: 24, items: [{label: '凡例', line: 'dashed', arrow: 'both', textW: 20, w: 60, x: 0, y: 0}]} as never, ld, NO_TONES, {sans: 'S', mono: 'M'}, () => ++n), /<a:headEnd type="triangle"[\s\S]*<a:tailEnd type="triangle"[\s\S]*<a:t>凡例<\/a:t>/);
  const band = {type: 'cause', x: 0, y: 0, w: 200, h: 100, nodes: [{x: 0, y: 40, w: 40, h: 20, tone: 'plain', core: true}, {x: 100, y: 40, w: 60, h: 20, tone: 'plain', hex: true}], edges: [], ands: [], loose: [], texts: [], anchors: [{id: 'a', x: 0, y: 40, w: 40, h: 20}, {id: 'h', x: 100, y: 40, w: 60, h: 20}], labelBoxes: []};
  n = 0;
  const c = causeXml(band as never, ld, NO_TONES, {sans: 'S', mono: 'M'}, () => ++n);
  assert.deepEqual(c.glue.map(g => g.dslId), ['a', 'h']);
  // the core driver: a 3.5px frame and its badge; the obstacle: a hexagon (six sides) with a 2px frame
  assert.match(c.xml, /name="a"[\s\S]*?<a:ln w="33338">/);
  assert.match(c.xml, /name="core-badge-a"[\s\S]*<a:t>中核<\/a:t>/);
  assert.match(c.xml, /name="h"[\s\S]*?(<a:lnTo>[\s\S]*?){5}<a:close\/>[\s\S]*?<a:ln w="19050">/);
});
