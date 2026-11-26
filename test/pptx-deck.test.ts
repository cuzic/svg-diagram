// A deck of 16:9 slides (ADR 0055): "svg-diagram/pptx/deck/edge", the pure planner (lib/pptx/deck.ts) and the checks of the input.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {build as bundle} from 'esbuild';
import {closeMeasurer} from '../lib/dsl.ts';
import {partCatalog, specToDiagram, validateAgainst} from '../lib/spec.ts';
import {deckSchema, figurePath} from '../lib/deck-spec.ts';
import {renderInBrowser} from '../lib/web.ts';
import {guardedEngine} from '../lib/spec-edge.ts';
import {renderDeckPptxEdge, validateDeck} from '../lib/pptx-deck-edge.ts';
import {SLIDE_H, SLIDE_W, deckEntries, placeShapes, planDeckSlide, roomMessage, smallTextWarning, type PlannedSlide} from '../lib/pptx/deck.ts';
import {TEMPLATE} from '../lib/pptx/template.ts';
import {planSlide, fontsOf} from '../lib/pptx/slide.ts';
import {EMU} from '../lib/pptx/xml.ts';
import {xmlProblems} from '../lib/xml-check.ts';
import {realEngine} from './helpers/text-engine.ts';
import {unzipEntry, unzipNames} from './helpers/pptx/unzip.ts';
import {hasXmllint, hasXsd, slideSchemaProblems} from './helpers/pptx/xsd.ts';

test.after(() => closeMeasurer());
const ROOT = path.resolve(import.meta.dirname, '..');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const example = (type: string) => partCatalog().find(p => p.type === type)?.example;
const figure = (type: string) => ({version: 1, title: type, parts: [example(type)]});
const entry = (pptx: Uint8Array, name: string) => unzipEntry(Buffer.from(pptx), name).toString();
const DECK = {title: 'デッキ', slides: [
  {title: '流れ', lead: '最初のスライドのリード文。', figure: figure('flowchart'), notes: '一行目\n二行目'},
  {title: '表', figure: figure('table'), callouts: [{label: '足す一文：', text: '「短い見本を 3 つ作って。」'}], source: '出典: テスト'},
  {title: '図のないスライド', lead: '文字だけ。'},
]};

test('the entry reaches no node: module, directly or through what it imports', async () => {
  const out = await bundle({entryPoints: [path.join(ROOT, 'lib/pptx-deck-edge.ts')], bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', logLevel: 'silent'});
  const imports = Object.values(out.metafile.outputs).flatMap(o => o.imports.map(i => i.path));
  assert.deepEqual(imports.filter(i => i.startsWith('node:')), []);
});

test('validateDeck: a bad deck comes back with places in the deck, a figure\'s mistakes under slides[i].figure (figurePath), the rest checked by validateAgainst', () => {
  assert.equal(figurePath(2, ''), 'slides[2].figure');
  assert.equal(figurePath(0, 'parts[1].nodes'), 'slides[0].figure.parts[1].nodes');
  assert.deepEqual(validateAgainst({type: 'string', maxLength: 2}, 'abc', 'x').map(i => i.path), ['x']);
  assert.deepEqual(validateDeck({slides: []}).map(i => i.path), ['slides']);
  assert.deepEqual(validateDeck({slides: [{lead: 'x'}]}), [{path: 'slides[0]', message: 'needs a title, a figure or columns'}]);
  const bad = validateDeck({slides: [{title: 'a'}, {figure: {version: 1, title: 't', parts: [{type: 'flowchart', nodes: 'x'}]}}]});
  assert.ok(bad.length > 0 && bad.every(i => i.path.startsWith('slides[1].figure.parts[0]')), JSON.stringify(bad));
  assert.deepEqual(validateDeck({slides: [{title: 'a', callouts: [{text: '1'}, {text: '2'}, {text: '3'}, {text: '4'}]}]}).map(i => i.path), ['slides[0].callouts']);
  assert.deepEqual(validateDeck({slides: [{title: 'a', notes: '一\n二\r\n三'}]}), [], 'notes may hold line breaks');
  assert.deepEqual(validateDeck({slides: [{title: 'a', colour: 'red'}]}).map(i => i.path), ['slides[0].colour']);
  assert.deepEqual(validateDeck({slides: [{title: 'a', callouts: undefined}]}).map(i => i.message), ['must be an array (got nothing)']);
  assert.deepEqual(validateDeck({slides: [{title: 'a', notes: '\t一\n\t二'}]}), [], 'notes may be indented with tabs');
  const flow = {type: 'flowchart', nodes: [{id: 'a', label: 'a'}], edges: []};
  assert.deepEqual(validateDeck({slides: [{figure: {version: 1, title: 't', canvas: {width: 1920}, parts: [flow]}}]}).map(i => i.path), ['slides[0].figure.canvas'], 'a deck sizes its figures itself');
  assert.deepEqual(validateDeck({slides: [{figure: {version: 1, title: 't', canvas: {width: 99999}, parts: [flow]}}]}).map(i => i.path), ['slides[0].figure.canvas'], 'said once, not with the canvas\'s own mistakes');
  const twice = {type: 'flowchart', nodes: [{id: 'a', label: 'a'}, {id: 'a', label: 'b'}], edges: [{from: 'a', to: 'z'}]};
  const both = validateDeck({slides: [{figure: {version: 1, title: 't', canvas: {width: 99999}, parts: [twice]}}]}).map(i => i.path);
  assert.equal(both[0], 'slides[0].figure.canvas');
  assert.ok(both.length > 1 && both.slice(1).every(p => p.startsWith('slides[0].figure.parts[0].')), `the rest of the figure is still checked: ${both.join(', ')}`);
  assert.equal(deckSchema.properties?.['slides']?.items?.properties?.['figure']?.properties?.['canvas'], undefined, 'and does not offer a canvas');
});

test('a deck is one file of 16:9 slides with notes, every shape on its slide and every connector glued to a shape of its own slide', async () => {
  const r = await renderDeckPptxEdge(DECK, realEngine(), {rasterize: () => PNG});
  assert.deepEqual(r.issues, []);
  const pptx = r.pptx as Uint8Array;
  const pres = entry(pptx, 'ppt/presentation.xml');
  assert.match(pres, new RegExp(`<p:sldSz cx="${SLIDE_W * EMU}" cy="${SLIDE_H * EMU}"/>`));
  assert.equal(pres.match(/<p:sldId /g)?.length, 3);
  assert.ok(pres.indexOf('<p:notesMasterIdLst>') < pres.indexOf('<p:sldIdLst>'), 'pml.xsd: the notes master list comes before the slide list');
  assert.match(entry(pptx, 'docProps/app.xml'), /<Slides>3<\/Slides>/);
  assert.match(entry(pptx, 'docProps/core.xml'), /<dc:title>デッキ<\/dc:title>/);
  assert.match(entry(pptx, 'ppt/notesSlides/notesSlide1.xml'), /<a:t>一行目<\/a:t><\/a:r><\/a:p><a:p><a:r><a:rPr lang="ja-JP" dirty="0"\/><a:t>二行目<\/a:t>/);
  for (let i = 1; i <= 3; i++) {
    const xml = entry(pptx, `ppt/slides/slide${i}.xml`);
    assert.deepEqual(xmlProblems(xml), [], `slide ${i}`);
    assert.match(entry(pptx, `ppt/slides/_rels/slide${i}.xml.rels`), new RegExp(`notesSlide${i}\\.xml`));
    assert.match(entry(pptx, `ppt/notesSlides/_rels/notesSlide${i}.xml.rels`), new RegExp(`slides/slide${i}\\.xml`));
    for (const m of xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)) {
      const [x, y, cx, cy] = m.slice(1).map(Number) as [number, number, number, number];
      assert.ok(x >= 0 && y >= 0 && x + cx <= SLIDE_W * EMU + 1 && y + cy <= SLIDE_H * EMU + 1, `slide ${i}: ${m[0]} is off the slide`);
    }
    const ids = new Set([...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => m[1]));
    assert.equal(ids.size, [...xml.matchAll(/<p:cNvPr id="/g)].length, `slide ${i}: shape ids are unique`);
    for (const m of xml.matchAll(/<a:(?:stCxn|endCxn) id="(\d+)"/g)) assert.ok(ids.has(m[1]), `slide ${i}: a connector is glued to shape ${m[1]}, which is not on the slide`);
  }
  assert.match(entry(pptx, 'ppt/slides/slide2.xml'), /<a:t>「短い見本を 3 つ作って。」<\/a:t>/);
  assert.deepEqual(r.slides.map(s => s.scale === null), [false, false, true]);
});

// Every PresentationML / DrawingML part of the package, not only the slides: the notes pages broke pml.xsd (xml:space on <a:t>) while every slide passed.
// CI installs xmllint and the schemas (.github/workflows/test.yml), so there the check never skips.
test('every part of a deck validates against pml.xsd: slides, notes pages, masters, layouts, theme, presentation', {skip: !process.env['CI'] && !(hasXmllint() && hasXsd())}, async () => {
  const deck = {title: 'デッキ', slides: [
    ...DECK.slides,
    {title: '長い脚注', lead: '本文。', source: '出典: ' + '資料の名前と年と頁。'.repeat(30), notes: '  先頭に空白\n\t字下げ\n\n末尾  '},
  ]};
  const r = await renderDeckPptxEdge(deck, realEngine(), {rasterize: () => PNG});
  assert.deepEqual(r.issues, []);
  const zip = Buffer.from(r.pptx as Uint8Array);
  const parts = unzipNames(zip).filter(n => n.startsWith('ppt/') && n.endsWith('.xml'));
  assert.ok(parts.includes('ppt/notesSlides/notesSlide4.xml') && parts.includes('ppt/presentation.xml'), parts.join(', '));
  for (const name of parts) assert.deepEqual(slideSchemaProblems(unzipEntry(zip, name).toString()), [], name);
});

test('the same deck gives the same bytes', async () => {
  const engine = realEngine();
  const a = await renderDeckPptxEdge(DECK, engine, {rasterize: () => PNG}), b = await renderDeckPptxEdge(DECK, engine, {rasterize: () => PNG});
  assert.deepEqual(Buffer.from(a.pptx as Uint8Array), Buffer.from(b.pptx as Uint8Array));
});

test('a figure that cannot be drawn is reported at its place in the deck, and no file is made', async () => {
  const r = await renderDeckPptxEdge({slides: [{title: 'a'}, {figure: {version: 1, title: 't', parts: [{type: 'flowchart', nodes: [{id: 'a', label: '안녕'}], links: []}]}}]}, realEngine(), {rasterize: () => PNG});
  assert.equal(r.pptx, null);
  assert.ok(r.issues.length > 0 && r.issues.every(i => i.path.startsWith('slides[1].figure')), JSON.stringify(r.issues));
});

// every numeric attribute the writer emits, on the side placeShapes puts it: scaled (a length on the slide) or kept (a path's own space, an
// angle, a count, an id, a flag). A new attribute fails this test until it is put on one side.
const SCALED = new Set(['a:off x', 'a:off y', 'a:chOff x', 'a:chOff y', 'a:ext cx', 'a:ext cy', 'a:chExt cx', 'a:chExt cy', 'a:gridCol w', 'a:tr h', 'a:tab pos',
  'a:tcPr marL', 'a:tcPr marR', 'a:tcPr marT', 'a:tcPr marB', 'a:bodyPr lIns', 'a:bodyPr tIns', 'a:bodyPr rIns', 'a:bodyPr bIns', 'a:pPr marL', 'a:pPr indent',
  'a:rPr sz', 'a:defRPr sz', 'a:endParaRPr sz', 'a:spcPts val', 'a:ln w', 'a:lnL w', 'a:lnR w', 'a:lnT w', 'a:lnB w']);
const KEPT = new Set(['a:alpha val', 'a:arcTo hR', 'a:arcTo wR', 'a:arcTo stAng', 'a:arcTo swAng', 'a:cxn ang', 'a:path w', 'a:path h', 'a:pt x', 'a:pt y', 'a:pos x', 'a:pos y',
  'a:endCxn id', 'a:endCxn idx', 'a:stCxn id', 'a:stCxn idx', 'a:graphicFrameLocks noGrp', 'a:rPr b', 'a:rPr dirty', 'a:rPr kern', 'a:tc gridSpan', 'a:tc rowSpan', 'a:tc hMerge', 'a:tc vMerge',
  'a:xfrm flipH', 'a:xfrm flipV', 'a:xfrm rot', 'p:cNvPr id', 'a:gd fmla', 'a:picLocks noChangeAspect', 'a:spLocks noGrp']);

test('every numeric attribute the writer emits is either scaled or kept by placeShapes, and the scaled ones are', async () => {
  const engine = guardedEngine(realEngine());
  const seen = new Set<string>();
  let probe = '';
  for (const {type, example: ex} of partCatalog()) {
    const r = await renderInBrowser(specToDiagram({version: 1, title: '例', parts: [ex]}), {measure: engine.measure});
    const xml = planSlide(r.laidOut, fontsOf()).xml;
    if (type === 'table' || type === 'flowchart') probe += xml;
    for (const m of xml.matchAll(/<([\w:]+)((?:\s[\w:]+="[^"]*")*)\s*\/?>/g)) for (const a of (m[2] ?? '').matchAll(/\s([\w:]+)="-?\d+"/g)) seen.add(`${m[1]} ${a[1]}`);
  }
  assert.deepEqual([...seen].filter(k => !SCALED.has(k) && !KEPT.has(k)).sort(), [], 'put each new attribute in SCALED or KEPT (and in placeShapes when it is scaled)');
  // the scaled ones change by k, the kept ones do not
  const half = placeShapes(probe, 0.5, 0, 0);
  const values = (xml: string, key: string) => { const [el, at] = key.split(' '); return [...xml.matchAll(new RegExp(`<${el}\\b[^>]*?\\s${at}="(-?\\d+)"`, 'g'))].map(m => Number(m[1])); };
  for (const key of [...seen].filter(k => SCALED.has(k))) {
    const before = values(probe, key), after = values(half, key);
    // halved (to the EMU), except where placeShapes keeps a floor: text at 1pt, a line at 0.25pt
    const floor = /\bsz$/.test(key) ? 100 : /^a:ln[LRTB]? w$/.test(key) ? 3175 : 0;
    assert.equal(after.length, before.length, key);
    before.forEach((v, i) => assert.ok(Math.abs((after[i] ?? -1) - Math.max(floor, v / 2)) <= 1 || (v === 0 && after[i] === 0), `${key}: ${v} → ${after[i]}`));
  }
  for (const key of [...seen].filter(k => KEPT.has(k))) assert.deepEqual(values(half, key), values(probe, key), key);
});

test('a slide whose text leaves no room says so (roomMessage), and a figure whose text gets small is a warning (smallTextWarning)', () => {
  const plan = {xml: '<p:spTree><p:grpSpPr></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="x"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:rPr lang="ja-JP" sz="1050"/><a:t>x</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>', cx: 0, cy: 0, pictures: []};
  const width = (t: string, size: number) => t.length * size;
  const long = 'あ'.repeat(300);
  const crowded = planDeckSlide({title: 't', lead: long, callouts: [{text: long}, {text: long}, {text: long}], source: long, figure: {plan, w: 100, h: 100}}, fontsOf(), width);
  assert.equal(crowded.noRoom, true);
  const wide = planDeckSlide({title: 't', figure: {plan, w: 4000, h: 100}}, fontsOf(), width);
  assert.match(roomMessage(true), /no room for the figure/);
  assert.match(roomMessage(false), /run into the callouts/);
  assert.match(smallTextWarning(wide) ?? '', /^scaled to 29% to fit the slide/);
  assert.equal(smallTextWarning({...wide, scale: 1.25, minTextPt: 7}), 'its smallest text is 7.0pt (under 9pt): split the figure, or move text off the slide', 'an enlarged figure is not said to be scaled to fit');
  assert.equal(smallTextWarning({...wide, minTextPt: 12}), null);
  assert.ok(wide.scale !== null && wide.scale < 0.3 && wide.minTextPt !== null && wide.minTextPt < 4, JSON.stringify({scale: wide.scale, min: wide.minTextPt}));
});

test('a slide without a figure whose text runs into its callouts is refused, and notes keep their blank lines and indents', async () => {
  const long = 'あ'.repeat(300), width = (t: string, size: number) => t.length * size;
  const crowded = planDeckSlide({title: 'あ'.repeat(120), lead: long, callouts: [{text: long}, {text: long}, {text: long}], source: long}, fontsOf(), width);
  assert.equal(crowded.noRoom, true);
  assert.equal(planDeckSlide({title: 't', lead: 'short'}, fontsOf(), width).noRoom, false);
  const r = await renderDeckPptxEdge({slides: [{title: 'a', notes: '\n一\n\n\t二\n'}]}, realEngine(), {rasterize: () => PNG});
  assert.match(entry(r.pptx as Uint8Array, 'ppt/notesSlides/notesSlide1.xml'), /<a:t>一<\/a:t><\/a:r><\/a:p><a:p><a:endParaRPr lang="ja-JP" dirty="0"\/><\/a:p><a:p><a:r><a:rPr lang="ja-JP" dirty="0"\/><a:t>    二<\/a:t>/);
});

test('a changed template stops the deck instead of making a broken file', () => {
  const slide: PlannedSlide = {xml: '<x/>', notes: '', pictures: [], scale: null, minTextPt: null, noRoom: false, name: 'a'};
  assert.throws(() => deckEntries([slide], [[]], 't', TEMPLATE.map(t => t.name === 'docProps/app.xml' ? {...t, text: t.text.replace('<Slides>1</Slides>', '<Slides>2</Slides>')} : t)), /no longer has Slides/);
});

test('pictures are numbered across the deck, each slide naming its own in its rels', () => {
  const slide = (n: number): PlannedSlide => ({xml: `<slide${n}/>`, notes: '', pictures: [{svg: `<svg id="s${n}"/>`, pngSvg: ''}], scale: 1, minTextPt: null, noRoom: false, name: `s${n}`});
  const files = new Map(deckEntries([slide(1), slide(2)], [[PNG], [PNG]]).map(e => [e.name, new TextDecoder().decode(e.data)]));
  assert.equal(files.get('ppt/media/image1.svg'), '<svg id="s1"/>');
  assert.equal(files.get('ppt/media/image2.svg'), '<svg id="s2"/>');
  assert.match(files.get('ppt/slides/_rels/slide2.xml.rels') ?? '', /Id="rId12"[^>]*Target="\.\.\/media\/image2\.png"/);
  assert.match(files.get('ppt/slides/_rels/slide1.xml.rels') ?? '', /Id="rId13"[^>]*Target="\.\.\/media\/image1\.svg"/);
  assert.ok(!files.has('ppt/media/image3.png'));
});
