// ADR 0058: a deck slide in columns — the input and its checks, where the columns go, the figures side by side on one PowerPoint slide (their
// shape ids, connector glue and picture relationships kept apart), the issues with their places, and the same slide as `serve` draws it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {build as bundle} from 'esbuild';
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
  // a column's figure is sized by its column (ADR 0059), so a canvas (ADR 0057) is refused there as on a slide's own figure, once
  assert.deepEqual(at({slides: [{columns: [{figure: {...f, canvas: {width: 1920}}}, {text: 'x'}]}]}), ['slides[0].columns[0].figure.canvas']);
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

test('ADR 0059: a spec may give its own width (320 to 940); a column figure without one is laid out at the column\'s width', async () => {
  const {validateSpec, specToDiagram} = await import('../lib/spec.ts');
  const {columnSpec, columnFallbackWarning} = await import('../lib/deck-spec.ts');
  const {columnWidths, columnLayoutWidth, COLUMN_FIGURE_SCALE} = await import('../lib/deck-layout.ts');
  const f = spec('table');
  assert.deepEqual(validateSpec({...f, width: 500}), []);
  assert.equal(specToDiagram({...f, width: 500}).width, 500);
  assert.deepEqual(validateSpec({...f, width: 1200}).map(i => i.path), ['width'], 'wider than the document is a canvas (ADR 0057), not a width');
  assert.deepEqual(validateSpec({...f, width: 200}).map(i => i.path), ['width']);
  const [a, b] = columnWidths([{}, {width: 2}]);
  assert.ok(a && b && Math.abs(b - 2 * a) < 1e-9);
  assert.equal(columnLayoutWidth(572, {min: 320, max: 940}), Math.round(572 / COLUMN_FIGURE_SCALE));
  assert.equal(columnSpec(f, 572).auto, 665);
  assert.equal((columnSpec(f, 572).spec as {width: number}).width, 665);
  assert.deepEqual(columnSpec({...f, width: 800}, 572), {spec: {...f, width: 800}, auto: null}, 'the figure\'s own width is kept');
  assert.equal(columnSpec(f, 900).auto, null, 'a column as wide as the document: as it is');
  assert.match(columnFallbackWarning(665, 'mindmap(): the figure does not fit 625px.\ntried: …'), /^does not fit the column's 665px \(mindmap\(\): the figure does not fit 625px\.\); drawn at 940px and shrunk instead/);
});

test('ADR 0059: a column figure is drawn at its column\'s width (no shrinking past 9pt), and one that does not fit is drawn at 940 with a warning', async () => {
  const wide = {version: 1, title: 'cloud', parts: [example('cloud')]};
  const r = await renderDeckPptxEdge({fit: 'width', slides: [
    {title: '二段', columns: [{figure: spec('table')}, {figure: spec('steps')}]},
    {title: '三段', columns: [{figure: wide}, {text: 'x'}, {text: 'y'}]},
  ]}, realEngine(), {rasterize: () => PNG});
  assert.deepEqual(r.issues, []);
  assert.ok((r.slides[0]?.columns ?? []).every(c => c.minTextPt === null || c.minTextPt >= 9), JSON.stringify(r.slides[0]?.columns));
  const fallback = r.warnings.find(w => w.path === 'slides[1].columns[0].figure' && w.message.startsWith('does not fit the column'));
  assert.ok(fallback, JSON.stringify(r.warnings));
});

test('ADR 0059 in serve: the same fallback, said as a warning at the column figure\'s place', async () => {
  installResolveHook();
  configureMeasure({measure: 'font', fonts: JA_FONTS});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-columns-'));
  try {
    fs.writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({fit: 'width', slides: [{title: '三段', columns: [{figure: {version: 1, title: 'cloud', parts: [example('cloud')]}}, {text: 'x'}, {figure: spec('table')}]}]}));
    const got = loadDeck(path.join(dir, 'deck.json'));
    assert.ok(got.ok);
    const r = await renderDeck(got.loaded, {measure: 'font', fonts: JA_FONTS});
    assert.deepEqual(r.errors, []);
    assert.ok(r.warnings.some(w => w.startsWith('slides[0].columns[0].figure: does not fit the column\'s')), JSON.stringify(r.warnings));
    assert.ok(!r.warnings.some(w => w.startsWith('slides[0].columns[2].figure: does not fit')), 'the table fits its column');
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('ADR 0060 fillSearch: narrower while the width holds the figure back; stops at the height, at a new check, or at a width that fails', async () => {
  const {fillSearch, FILL_WIDTHS} = await import('../lib/deck-layout.ts');
  // a figure whose height grows as it narrows: area constant
  const area = (flags: (w: number) => string[] = () => []) => async (w: number | null) => { const ww = w ?? 940; return {ok: true as const, w: ww, h: 300 * 940 / ww, value: ww, flags: flags(ww)}; };
  const tall = await fillSearch({w: 572, h: 450}, 1.5, area());
  assert.ok(tall.ok && tall.width !== null && tall.width < 940 && tall.width >= 563, JSON.stringify(tall));
  assert.ok(tall.ok && tall.k > 572 / 940);
  const flat = await fillSearch({w: 1168, h: 200}, 1.5, area());
  assert.ok(flat.ok && flat.width === null && flat.tried === 1, 'the height holds it back already: nothing narrower is tried');
  const broken = await fillSearch({w: 572, h: 2000}, 1.5, area(w => w < 700 ? ['text-mid-word-break'] : []));
  assert.ok(broken.ok && broken.width === 728, 'a narrower width that breaks words is not taken, and the search stops there');
  const failing = await fillSearch({w: 572, h: 2000}, 1.5, async w => (w ?? 940) < 800 ? {ok: false, why: 'too narrow'} : {ok: true, w: w ?? 940, h: 300, value: 0, flags: []});
  assert.ok(failing.ok && failing.width === 827 && failing.narrower?.width === 728 && failing.narrower.why === 'too narrow');
  assert.deepEqual(await fillSearch({w: 572, h: 450}, 1.5, async () => ({ok: false, why: 'no'})), {ok: false, why: 'no'});
  assert.ok(FILL_WIDTHS.every((w, i) => i === 0 || w < (FILL_WIDTHS[i - 1] ?? 0)));
});

test('ADR 0060: fill is the default and draws a figure larger than width does (up to 1.5); fit "width" keeps ADR 0055 / 0059', async () => {
  const deck = (fit?: 'fill' | 'width') => ({...(fit ? {fit} : {}), slides: [{title: '表', figure: spec('table')}, {title: '二段', columns: [{text: '説明'}, {figure: spec('table')}]}]});
  const fill = await renderDeckPptxEdge(deck(), realEngine(), {rasterize: () => PNG});
  const width = await renderDeckPptxEdge(deck('width'), realEngine(), {rasterize: () => PNG});
  assert.deepEqual([fill.issues, width.issues], [[], []]);
  const k = (r: typeof fill, i: number) => r.slides[i]?.scale ?? r.slides[i]?.columns.find(c => c.scale !== null)?.scale ?? 0;
  assert.ok(k(fill, 0) >= k(width, 0) && k(fill, 0) <= 1.5 + 1e-9, `${k(fill, 0)} vs ${k(width, 0)}`);
  assert.ok(k(width, 0) <= 1.25 + 1e-9);
  assert.ok(k(fill, 1) >= k(width, 1), `${k(fill, 1)} vs ${k(width, 1)}`);
  const slideFit = await renderDeckPptxEdge({fit: 'width', slides: [{title: '表', figure: spec('table'), fit: 'fill'}]}, realEngine(), {rasterize: () => PNG});
  assert.equal(k(slideFit, 0), k(fill, 0), 'a slide\'s fit wins over the deck\'s');
});

test('ADR 0060 helpers: the room each figure gets, the cap per fit, the rule ids of findings, and which fit a slide takes', async () => {
  const {figureRooms, maxScale, ruleIds, SLIDE_W: W, MARGIN_X: M} = await import('../lib/deck-layout.ts');
  const {fitOf} = await import('../lib/deck-spec.ts');
  const one = figureRooms({title: '見出し'}, width);
  assert.equal(one.figure.w, W - 2 * M);
  assert.ok(one.figure.h > 400 && one.figure.h < 720);
  const two = figureRooms({title: '見出し', columns: [{text: 'x'}, {caption: '図'}]}, width);
  assert.equal(two.columns[0], null, 'a text column has no figure room');
  assert.ok(two.columns[1] && two.columns[1].h < one.figure.h, 'under its caption');
  assert.deepEqual([maxScale('fill'), maxScale('width')], [1.5, 1.25]);
  assert.deepEqual(ruleIds(['[text-mid-word-break] 語の途中', '[legend-missing] x', '[legend-missing] y', 'plain']), ['text-mid-word-break', 'legend-missing', 'plain']);
  assert.deepEqual([fitOf({slides: []}, {}), fitOf({fit: 'width', slides: []}, {}), fitOf({fit: 'width', slides: []}, {fit: 'fill'})], ['fill', 'width', 'fill']);
});

test('ADR 0061: columns left to choice — which slides choose, the shares laid out by, and what width "auto" means in the input', async () => {
  const {autoColumns, sharedColumns, writtenShares} = await import('../lib/deck-spec.ts');
  const cols = [{text: 'a'}, {figure: spec('table'), width: 'auto' as const}];
  assert.deepEqual(writtenShares(cols), [null, null]);
  assert.equal(autoColumns({slides: []}, {columns: cols}), true);
  assert.equal(autoColumns({fit: 'width', slides: []}, {columns: cols}), false, 'fit "width": equal shares, as before');
  assert.equal(autoColumns({slides: []}, {columns: [{text: 'a', width: 1}, {text: 'b'}]}), false, 'a share written anywhere: no choosing');
  assert.deepEqual(sharedColumns(cols).map(c => c.width), [1, 1]);
  assert.deepEqual(sharedColumns(cols, [1, 3]).map(c => c.width), [1, 3]);
  assert.deepEqual(validateDeck({slides: [{columns: [{text: 'a', width: 'auto'}, {text: 'b'}]}]}), []);
  assert.deepEqual(validateDeck({slides: [{columns: [{text: 'a', width: 'wide'}, {text: 'b'}]}]}).map(i => i.path), ['slides[0].columns[0].width']);
});

test('ADR 0061 chooseColumns: the least empty room with every figure at 9pt or more; a text that does not fit rules a share out', async () => {
  const {chooseColumns} = await import('../lib/deck-layout.ts');
  // a wide, flat figure: 940 x 300 at any width; its smallest text 10.5pt at scale 1
  const flat = async (_j: number, w: number | null) => w === null ? {ok: true as const, w: 940, h: 300, value: 'f', flags: [], minPt: 10.5} : {ok: false as const, why: 'fixed'};
  const s = {title: '見出し', columns: [{text: '短い説明'}, {caption: '図'}]};
  const r = await chooseColumns(s, width, 1.5, flat);
  assert.ok(r.ok);
  assert.deepEqual(r.shares, [1, 3], 'the figure takes the most of the row');
  assert.ok(r.minPt !== null && r.minPt >= 9 && !r.small);
  // the text column must hold its text: a long text keeps its column wide enough
  const long = await chooseColumns({title: '見出し', columns: [{text: 'とても長い説明の文。'.repeat(50)}, {caption: '図'}]}, width, 1.5, flat);
  assert.ok(long.ok && (long.shares[0] ?? 0) / (long.shares[1] ?? 1) > 1 / 3, JSON.stringify(long.ok && long.shares));
  // a figure whose text is small at every share: the share with the largest smallest text, said to be small
  const tiny = await chooseColumns(s, width, 1.5, async (_j, w) => w === null ? {ok: true, w: 940, h: 300, value: 't', flags: [], minPt: 6} : {ok: false, why: 'fixed'});
  assert.ok(tiny.ok && tiny.small && tiny.shares[1] === 3);
  assert.deepEqual(await chooseColumns(s, width, 1.5, async () => ({ok: false, why: 'cannot'})), {ok: false, why: 'cannot'});
});

test('ADR 0061: a value chain\'s chevron gives its text the whole room between its slanted sides, so a narrow one keeps its words whole', async () => {
  const {renderSpec} = await import('../lib/spec-render.ts');
  const vc = {version: 1, title: 'vc', width: 563, parts: [{type: 'valueChain', margin: '利益', support: [{label: 'レシピ開発'}, {label: '撮影・編集', sub: '週15時間'}], primary: [{label: '集客', sub: 'SNS・ブログ'}, {label: '体験レッスン', sub: '入会は5人に1人'}, {label: '入会・決済'}, {label: '動画レッスン', sub: '毎月8本の新作'}, {label: '継続フォロー', sub: 'ほぼできていない'}]}]};
  const r = await renderSpec(vc, {config: {measure: 'font', fonts: JA_FONTS}});
  assert.ok(r.ok, JSON.stringify(r.issues));
  assert.ok(!r.findings.some(f => f.rule === 'text-mid-word-break'), JSON.stringify(r.findings.map(f => f.rule)));
  // narrower still, the words are cut, and the check still sees it although each line sits at its own x
  const narrow = await renderSpec({...vc, width: 436}, {config: {measure: 'font', fonts: JA_FONTS}});
  assert.ok(narrow.findings.some(f => f.rule === 'text-mid-word-break'));
});

test('deck validation can use only the spec parts needed by its figures', async () => {
  const {validateDeckWith} = await import('../lib/deck-spec-core.ts');
  const {validateSpec} = await import('../lib/spec-selective.ts');
  const {pyramidPart} = await import('../lib/spec-parts/selective/pyramid.ts');
  const seen: unknown[] = [];
  const pyramid = {version: 1, title: '計画', legend: false, parts: [pyramidPart.example]};
  const input = {slides: [
    {layout: 'cover', title: '表紙', figure: pyramid},
    {figure: pyramid},
    {columns: [{figure: {...pyramid, canvas: {}, parts: [{type: 'pyramid'}]}}, {text: '説明'}]},
  ]};
  const actual = validateDeckWith(input, figure => {
    seen.push(figure);
    return validateSpec(figure, {parts: [pyramidPart]});
  });
  assert.equal(seen.length, 2);
  assert.ok(seen.every(figure => !Object.hasOwn(figure as object, 'canvas')));
  assert.deepEqual(actual, validateDeck(input));
});

test('the deck validator does not bundle the full spec catalog', async () => {
  const root = path.join(import.meta.dirname, '..');
  const result = await bundle({
    absWorkingDir: root,
    stdin: {contents: `
      import {validateDeckWith} from './lib/deck-spec-core.ts';
      import {validateSpec} from './lib/spec-selective.ts';
      import {pyramidPart} from './lib/spec-parts/selective/pyramid.ts';
      export const validate = deck => validateDeckWith(deck, figure => validateSpec(figure, {parts: [pyramidPart]}));
    `, resolveDir: root},
    bundle: true, platform: 'browser', format: 'esm', metafile: true, write: false,
  });
  const inputs = Object.keys(Object.values(result.metafile.outputs)[0]?.inputs ?? {});
  assert.ok(inputs.includes('lib/deck-spec-core.ts'));
  assert.ok(inputs.includes('lib/spec-parts/selective/pyramid.ts'));
  assert.ok(!inputs.some(input => /^lib\/(?:deck-spec\.ts|spec\.ts|spec-parts\/r[1-7]\.ts)$/.test(input)), inputs.join('\n'));
});

test('selective deck loading checks JSON paths and columns with the same locations', async () => {
  const {loadDeckSelective} = await import('../lib/deck-load-selective.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-selective-deck-'));
  try {
    const file = path.join(dir, 'deck.json');
    const figureFile = path.join(dir, 'figure.json');
    fs.writeFileSync(figureFile, JSON.stringify({...spec('pyramid'), $schema: './schema.json'}));
    const write = (figure: unknown) => fs.writeFileSync(file, JSON.stringify({
      slides: [{figure: 'figure.json'}, {columns: [{figure}, {text: '説明'}]}],
    }));
    write(spec('table'));
    const loaded = await loadDeckSelective(file);
    assert.ok(loaded.ok);
    assert.deepEqual(loaded, loadDeck(file));
    assert.deepEqual(loaded.loaded.files, [file, figureFile]);
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import {registerHooks} from 'node:module';
      const urls = new Set();
      registerHooks({load(url, context, next) {
        urls.add(url);
        return next(url, context);
      }});
      const {loadDeckSelective} = await import('./lib/deck-load-selective.ts');
      const result = await loadDeckSelective(process.argv[1]);
      if (!result.ok) throw new Error(result.errors.join('\\n'));
      console.log(JSON.stringify([...urls]));
    `, file], {cwd: path.join(import.meta.dirname, '..'), encoding: 'utf8'});
    assert.equal(child.status, 0, child.stderr);
    const urls: string[] = JSON.parse(child.stdout);
    const selected = urls.flatMap(url => /\/spec-parts\/selective\/([^/]+)\.ts$/.exec(url)?.[1] ?? []);
    assert.deepEqual(selected.sort(), ['pyramid', 'table']);
    assert.ok(!urls.some(url => /\/(?:spec|deck-spec|spec-parts\/r[1-7])\.ts$/.test(url)));
    for (const type of ['pyramid', 'unknown', 'constructor']) {
      write({version: 1, title: '不正な図', parts: [{type}]});
      const invalid = await loadDeckSelective(file);
      assert.ok(!invalid.ok);
      assert.deepEqual(invalid, loadDeck(file));
      assert.match(invalid.errors[0] ?? '', /^slides\[1\]\.columns\[0\]\.figure/);
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('JSON deck rendering draws the selected part without loading the full catalog', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import {registerHooks} from 'node:module';
    const urls = new Set();
    registerHooks({load(url, context, next) { urls.add(url); return next(url, context); }});
    const {renderDeckFigure} = await import('./lib/deck-render-figure.ts');
    const spec = {version: 1, title: '相談', width: 440,
      parts: [{type: 'table', columns: [{label: '案'}], rows: [['先行テスト']]}]};
    const result = await renderDeckFigure(0, spec, undefined, {measure: 'font'});
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    console.log(JSON.stringify({svg: result.result.svg, width: result.result.width, urls: [...urls]}));
  `], {cwd: path.join(import.meta.dirname, '..'), encoding: 'utf8'});
  assert.equal(child.status, 0, child.stderr);
  const {svg, width, urls} = JSON.parse(child.stdout) as {svg: string; width: number; urls: string[]};
  assert.equal(width, 440);
  assert.match(svg, /先行テスト/);
  assert.match(svg, /<desc id="svg-desc">表: 列 案<\/desc>/);
  assert.ok(urls.some(url => url.endsWith('/spec-parts/selective/table.ts')));
  assert.ok(!urls.some(url => /\/(?:spec|dsl\/render|spec-parts\/r[1-7])\.ts$/.test(url)));
});

test('selected deck rendering preserves the catalog SVG, fit and CLI diagnostics', async () => {
  const {renderDeckSpec} = await import('../lib/deck-render-spec.ts');
  const {specToDiagram} = await import('../lib/spec.ts');
  const {renderDiagram} = await import('../lib/dsl/render.ts');
  const {applyConfig} = await import('../lib/config.ts');
  const cfg = {measure: 'font' as const, fonts: JA_FONTS, legend: 'auto' as const, maxWidth: 720,
    legendLabels: {'tone:accent': '注目'}, terms: {変更: ['テスト']}};
  for (const {type, example} of partCatalog()) {
    const input = {version: 1, lang: 'en', title: ' 計画 ', showTitle: true, sourceLine: '出典を確認', parts: [example]};
    const selected = await renderDeckSpec(input, cfg);
    assert.ok(selected, type);
    const legacy = await renderDiagram(applyConfig(specToDiagram(input), cfg), {name: 'slide1.svg', budget: 'cacheOnly'});
    for (const key of ['svg', 'width', 'height', 'xml', 'fit'] as const) assert.deepEqual(selected[key], legacy[key], `${type}: ${key}`);
    assert.deepEqual(selected.verdict.warnings, legacy.verdict.warnings, type);
    assert.deepEqual(selected.verdict.problems, legacy.verdict.problems, type);
  }
});
