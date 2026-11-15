// ADR 0058: a deck slide in columns — the input and its checks, where the columns go, the figures side by side on one PowerPoint slide (their
// shape ids, connector glue and picture relationships kept apart), the issues with their places, and the same slide as `serve` draws it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {columnFigurePath, validateDeck} from '../lib/deck-spec.ts';
import {COLUMN_GAP, MARGIN_X, planDeckLayout, SLIDE_W, type TextWidth} from '../lib/deck-layout.ts';
import {planDeckSlide, renumberShapes, slideIssues, type DeckFigure} from '../lib/pptx/deck.ts';
import {imageRids} from '../lib/pptx/package.ts';
import {fontsOf} from '../lib/pptx/slide.ts';
import {renderDeckPptxEdge} from '../lib/pptx-deck-edge.ts';
import {partCatalog} from '../lib/spec.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {checkSlideSvg} from '../lib/present/svg-allow.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const example = (type: string) => partCatalog().find(p => p.type === type)?.example;
const spec = (type: string) => ({version: 1, title: type, parts: [example(type)]});
const width: TextWidth = (t, size, bold) => [...t].length * size * (bold ? 1.05 : 1);

test('the input: 2 or 3 columns, each a figure or text; figure and columns do not go together; places are slides[i].columns[j]', () => {
  const f = spec('flowchart');
  assert.deepEqual(validateDeck({slides: [{columns: [{figure: f, caption: '左'}, {text: '・一\n・二', width: 2}]}]}), []);
  assert.deepEqual(validateDeck({slides: [{columns: [{figure: f}, {text: 'a'}, {text: 'b'}], columnScale: 'same'}]}), []);
  assert.equal(columnFigurePath(1, 2, 'parts[0]'), 'slides[1].columns[2].figure.parts[0]');
  assert.equal(columnFigurePath(1, 2, ''), 'slides[1].columns[2].figure');
  const at = (deck: unknown) => validateDeck(deck).map(x => x.path);
  assert.deepEqual(at({slides: [{figure: f, columns: [{figure: f}, {text: 'x'}]}]}), ['slides[0]']);
  assert.deepEqual(at({slides: [{columns: [{figure: f, text: 'x'}, {}]}]}), ['slides[0].columns[0]', 'slides[0].columns[1]']);
  assert.deepEqual(at({slides: [{columns: [{text: 'x'}]}]}), ['slides[0].columns']);
  assert.deepEqual(at({slides: [{columns: [{text: 'a'}, {text: 'b'}, {text: 'c'}, {text: 'd'}]}]}), ['slides[0].columns']);
  assert.deepEqual(at({slides: [{columns: [{text: 'a', width: 4}, {text: 'b'}]}]}), ['slides[0].columns[0].width']);
  assert.ok(at({slides: [{columns: [{figure: {version: 1, title: 't', parts: []}}, {text: 'x'}]}]}).every(p => p.startsWith('slides[0].columns[0].figure')));
});

test('the columns share the row by their widths with a gap between; contents start on one line; "same" puts every figure at one scale', () => {
  const l = planDeckLayout({title: '見出し'}, undefined, width, [{caption: '左', figure: {w: 400, h: 300}}, {figure: {w: 500, h: 200}, width: 2}]);
  const [a, b] = l.columns;
  assert.ok(a && b);
  const inner = SLIDE_W - 2 * MARGIN_X - COLUMN_GAP;
  assert.equal(a.x, MARGIN_X);
  assert.ok(Math.abs(a.width - inner / 3) < 1e-9 && Math.abs(b.width - inner * 2 / 3) < 1e-9);
  assert.ok(Math.abs(b.x - (a.x + a.width + COLUMN_GAP)) < 1e-9);
  assert.equal(a.figure?.y, b.figure?.y, 'both figures start under the tallest caption');
  assert.ok(a.figure && b.figure && a.figure.k !== b.figure.k);
  const same = planDeckLayout({title: '見出し'}, undefined, width, [{figure: {w: 400, h: 300}}, {figure: {w: 800, h: 300}}], 'same');
  assert.equal(same.columns[0]?.figure?.k, same.columns[1]?.figure?.k);
  // text: one block per paragraph, a bullet's text hanging under itself
  const t = planDeckLayout({title: '見出し'}, undefined, width, [{text: '・一つ目\n普通の行'}, {text: 'x'}]);
  assert.deepEqual(t.columns[0]?.text.map(b => b.name), ['column bullet', 'column text', 'column text']);
  assert.ok((t.columns[0]?.text[1]?.x ?? 0) > MARGIN_X);
  const long = planDeckLayout({title: '見出し'}, undefined, width, [{text: 'とても長い文。'.repeat(200)}, {text: 'x'}]);
  assert.equal(long.columns[0]?.noRoom, true);
});

test('figures side by side on one slide: shape ids, connector glue and picture relationships do not collide', () => {
  assert.equal(renumberShapes('<p:cNvPr id="2" name="a"/><a:stCxn id="2" idx="1"/><a:blip r:embed="rId12"/><a:x r:embed="rId3"/>', 10, 1),
    '<p:cNvPr id="12" name="a"/><a:stCxn id="12" idx="1"/><a:blip r:embed="rId14"/><a:x r:embed="rId3"/>');
  const plan = (pics: number): DeckFigure => ({w: 400, h: 200, plan: {
    title: 'fig', pictures: Array.from({length: pics}, () => ({svg: '<svg/>', pngSvg: '<svg/>'})),
    xml: `<p:sld><p:cSld><p:spTree><p:grpSpPr></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="box"/></p:nvSpPr><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></p:sp><p:cxnSp><p:cNvPr id="3" name="arrow"/><a:stCxn id="2" idx="0"/></p:cxnSp>${Array.from({length: pics}, (_, k) => `<p:pic><p:cNvPr id="${4 + k}" name="pic"/><a:blip r:embed="${imageRids(k).png}"><asvg:svgBlip r:embed="${imageRids(k).svg}"/></a:blip></p:pic>`).join('')}</p:spTree></p:cSld></p:sld>`,
  } as unknown as DeckFigure['plan']});
  const p = planDeckSlide({title: 'T', columns: [{figure: plan(1)}, {figure: plan(2)}]}, fontsOf(), width);
  const ids = [...p.xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'every shape id once');
  assert.equal(p.pictures.length, 3);
  assert.deepEqual([...p.xml.matchAll(/r:embed="(rId\d+)"/g)].map(m => m[1]), [0, 1, 2].flatMap(k => [imageRids(k).png, imageRids(k).svg]));
  const glue = [...p.xml.matchAll(/<a:stCxn id="(\d+)"/g)].map(m => m[1]);
  assert.ok(glue.every(g => ids.includes(g)) && new Set(glue).size === 2, 'each arrow glued to its own figure\'s box');
});

test('issues and warnings carry the column\'s place', () => {
  const small = {xml: '', notes: '', pictures: [], scale: null, minTextPt: null, noRoom: false, name: '', columns: [{scale: 0.5, minTextPt: 6, noRoom: false}, {scale: null, minTextPt: null, noRoom: true}]};
  const r = slideIssues(small, 4, false, ['figure', 'text']);
  assert.deepEqual(r.warnings.map(w => w.path), ['slides[4].columns[0].figure']);
  assert.deepEqual(r.errors.map(e => e.path), ['slides[4].columns[1].text']);
});

test('the edge writer: a column slide becomes one PowerPoint slide; a figure slide is as before', async () => {
  const r = await renderDeckPptxEdge({slides: [
    {title: '左右', columns: [{caption: '前', figure: spec('valueChain')}, {caption: '後', figure: spec('journeyMap')}]},
    {title: '説明と図', columns: [{text: '・一つ目\n・二つ目'}, {figure: spec('flowchart'), width: 2}]},
  ]}, realEngine(), {rasterize: () => PNG});
  assert.deepEqual(r.issues, []);
  assert.ok(r.pptx);
  assert.ok(r.warnings.every(w => /^slides\[\d\]\.columns\[\d\]\.figure$/.test(w.path)));
  assert.equal(r.slides[0]?.columns.length, 2);
  const xml = unzipEntry(Buffer.from(r.pptx), 'ppt/slides/slide1.xml').toString();
  const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(xml, /name="column caption"/);
  const bad = await renderDeckPptxEdge({slides: [{columns: [{figure: {version: 1, title: 't', parts: [{type: 'flowchart', nodes: [{id: 'a', label: 'x'}], edges: [{from: 'a', to: 'zz'}]}]}}, {text: 'x'}]}]}, realEngine(), {rasterize: () => PNG});
  assert.ok(bad.issues.length && bad.issues.every(i => i.path.startsWith('slides[0].columns[0].figure')), JSON.stringify(bad.issues));
});

test('serve draws a column slide: each figure nested with ids of its own, a .ts figure in a column, and the allowlist passes', async () => {
  installResolveHook();
  configureMeasure({measure: 'font', fonts: JA_FONTS});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-columns-'));
  try {
    fs.writeFileSync(path.join(dir, 'fig.ts'), `import {diagram, box} from 'svg-diagram';\nexport default () => diagram({theme: 'blue', title: 'ts'}).add(box({id: 'a', title: 'ソース'}));\n`);
    fs.writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({slides: [{title: '並べる', columns: [{figure: spec('flowchart')}, {figure: 'fig.ts'}]}]}));
    const got = loadDeck(path.join(dir, 'deck.json'));
    assert.ok(got.ok, JSON.stringify(got));
    assert.deepEqual([...got.loaded.sources.keys()], ['0:1']);
    const r = await renderDeck(got.loaded, {measure: 'font', fonts: JA_FONTS});
    assert.deepEqual(r.errors, []);
    const svg = r.slides[0]?.svg ?? '';
    assert.equal((svg.match(/<svg\b/g) ?? []).length, 3, 'the slide and two nested figures');
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'no id twice on the page');
    assert.deepEqual(checkSlideSvg(svg), {ok: true});
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
