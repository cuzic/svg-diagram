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

test('a table becomes a native table, a tree a picture whose text is outlines, with a PNG from the function handed in', async () => {
  const seen: {svg: string; scale: number}[] = [];
  const rasterize = async (svg: string, scale: number) => { seen.push({svg, scale}); return (await rasterizeWithResvg(svg, {scale, png: true})).png as Buffer; };
  const r = await renderPptxEdge(spec(example('table'), example('tree')), realEngine(), {rasterize});
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
