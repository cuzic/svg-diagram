// ADR 0045: the browser entry (lib/web.ts) draws a figure with a measurer the page gives, and nothing it reaches needs node:*.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {detachData} from '../lib/dsl/diagram.ts';
import {canvasMeasurer, svgMeasurer} from '../lib/web-measure.ts';
import {rolesAt, ROLES, canvasRoles} from '../lib/tokens.ts';
import {causeTree, cloud, diagram, gantt, image, math, renderInBrowser} from '../lib/web.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const guess = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.9, h: Math.round(size * 1.2)});
const smallCloud = () => diagram({theme: 'blue', title: 'クラウド'}).add(cloud({a: '成功させる', b: '品質を確保する', c: '機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'}));

test('detachData copies the bands, so a render never writes into the caller\'s diagram', () => {
  const d = smallCloud();
  const copy = detachData(d);
  assert.notEqual(copy.bands, d.bands);
  assert.notEqual(copy.bands[0], d.bands[0]);
  assert.deepEqual(copy.bands, d.bands);
});

test('canvasMeasurer reads the width from measureText and rounds the ascent and descent to whole pixels', () => {
  const seen: string[] = [];
  const ctx = {set font(v: string) { seen.push(v); }, get font() { return ''; }, measureText: (t: string) => ({width: t.length * 10, fontBoundingBoxAscent: 10.4, fontBoundingBoxDescent: 3.6})};
  const m = canvasMeasurer(ctx as never)({text: 'abc', size: 16, weight: 700, font: 'sans'});
  assert.deepEqual(m, {w: 30, h: 14});
  assert.match(seen[0]!, /^700 16px /);
});

test('canvasMeasurer does not return a NaN height where the font box is missing (Firefox before 116)', () => {
  const ctx = {font: '', measureText: () => ({width: 20, actualBoundingBoxAscent: 11.6, actualBoundingBoxDescent: 3.2})};
  assert.deepEqual(canvasMeasurer(ctx as never)({text: 'ab', size: 16, weight: 400, font: 'sans'}), {w: 20, h: 15});
  const bare = {font: '', measureText: () => ({width: 20})};
  assert.ok(Number.isFinite(canvasMeasurer(bare as never)({text: 'ab', size: 16, weight: 400, font: 'sans'}).h));
});

test('svgMeasurer sets the font on one hidden SVG <text>, reads its box, and removes the SVG on dispose', () => {
  const made: Record<string, unknown>[] = [];
  const el = (tag: string) => { const attrs: Record<string, string> = {}; const e: Record<string, unknown> = {tag, attrs, style: {} as Record<string, string>, textContent: '', setAttribute: (k: string, v: string) => { attrs[k] = v; }, setAttributeNS: (ns: string, k: string, v: string) => { attrs[`${ns}|${k}`] = v; }, appendChild: () => {}, remove: () => { e['removed'] = true; }, getBBox: () => ({width: String(e['textContent']).length * 7.5, height: 19}), }; made.push(e); return e; };
  const body = {appendChild: () => {}};
  void body;
  (globalThis as any).document = {body, createElementNS: (_: string, tag: string) => el(tag)};
  try {
    const m = svgMeasurer();
    assert.deepEqual(m({text: 'abcd', size: 21, weight: 700, font: 'mono'}), {w: 30, h: 19});
    const text = made.find(e => e['tag'] === 'text')!;
    const style = text['style'] as Record<string, string>;
    assert.equal(style['fontSize'], '21px');
    assert.equal(style['fontWeight'], '700');
    assert.match(style['fontFamily']!, /monospace|mono/i);
    assert.equal((text['attrs'] as Record<string, string>)['http://www.w3.org/XML/1998/namespace|xml:space'], 'preserve', 'xml:space is set in the XML namespace (a plain attribute of that name is ignored)');
    m.dispose();
    assert.equal(made.find(e => e['tag'] === 'svg')!['removed'], true);
  } finally { delete (globalThis as any).document; }
});

test('rolesAt: a canvas figure takes the canvas roles, any other the scaled ROLES', () => {
  assert.deepEqual(rolesAt(true, 1.5), canvasRoles(1.5));
  assert.deepEqual(rolesAt(false, 1), ROLES);
  assert.notDeepEqual(rolesAt(false, 2), ROLES);
});

test("renderInBrowser({today}) is the day of a gantt({today: 'auto'}); without it the figure says what is missing", async () => {
  const g = () => diagram({theme: 'blue', title: '工程'}).add(gantt([{label: '設計', start: '2026-10-19', end: '2026-10-30'}], {today: 'auto'}));
  assert.equal((await renderInBrowser(g(), {measure: guess, today: '2026-10-27'})).verdict.ok, true);
  await assert.rejects(renderInBrowser(g(), {measure: guess}), /today: 'auto' needs a date/);
  await assert.rejects(renderInBrowser(g(), {measure: guess, today: 'tomorrow'}), /renderInBrowser\(\{today\}\)/);
});

test('renderInBrowser asks the measurer once per distinct run, even when width: "fit" lays out several times', async () => {
  const seen = new Map<string, number>();
  const counting = (r: {text: string; size: number; weight: number; font: string}) => { const k = JSON.stringify(r); seen.set(k, (seen.get(k) ?? 0) + 1); return guess(r); };
  const d = diagram({theme: 'blue', title: 'クラウド', width: 'fit'}).add(cloud({a: '成功させる', b: '品質を確保する', c: '機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'}));
  const r = await renderInBrowser(d, {measure: counting});
  assert.equal(r.verdict.ok, true, JSON.stringify(r.verdict));
  assert.ok(seen.size > 0 && [...seen.values()].every(n => n === 1));
  assert.equal(r.fontScale, 1);
  assert.ok(r.fit);
});

test('renderInBrowser draws a cloud with the measurer it is given, and says so for math() / image() / slide figures', async () => {
  const r = await renderInBrowser(smallCloud(), {measure: guess});
  assert.equal(r.verdict.ok, true, JSON.stringify(r.verdict));
  assert.deepEqual(r.xml, []);
  assert.match(r.svg, /^<svg /);
  assert.ok(r.width > 0 && r.height > 0);
  assert.throws(() => math('x'), /math\(\) is not available in the browser entry/);
  assert.throws(() => image('a.png'), /image\(\) is not available in the browser entry/);
  await assert.rejects(renderInBrowser(diagram({theme: 'blue', fill: true, slide: {page: '1', heading: 'x'} as never}), {measure: guess}), /measured slide/);
});

test('diagram({legendLabels}) renames the legend entries of a future-reality tree in the browser entry too', async () => {
  const frt = (legendLabels?: Record<string, string>) => diagram({theme: 'blue', legend: 'auto', ...(legendLabels ? {legendLabels} : {})}).add(causeTree(
    [{id: 'de', label: '納期を守れる', role: 'de'}, {id: 'focus', label: '1 つずつ仕上げる'}, {id: 'cap', label: '着手の枠を決める', role: 'injection'}, {id: 'fact', label: '受注の量は変えられない', role: 'precondition'}],
    [{from: ['fact', 'cap'], to: 'focus'}, {from: 'focus', to: 'de'}], {tree: 'frt'}));
  const texts = async (l?: Record<string, string>) => [...(await renderInBrowser(frt(l), {measure: guess})).svg.matchAll(/>([^<>]+)</g)].map(m => m[1]);
  assert.ok((await texts()).includes('望む結果(DE)'));
  const plain = await texts({'role:de': '望む結果', 'role:injection': '打ち手', 'role:precondition': '今わかっている事実', 'edge:and': '合わせて必要'});
  for (const t of ['望む結果', '打ち手', '今わかっている事実', '合わせて必要']) assert.ok(plain.includes(t), t);
  assert.ok(!plain.some(t => /DE\)|AND\)/.test(t!)));
});

test('lib/web.ts bundles for the browser with no alias, stub or external, and reaches no node:* module', async () => {
  const res = await build({entryPoints: [path.join(ROOT, 'lib/web.ts')], bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true, logLevel: 'silent'});
  const bad = Object.entries(res.metafile.inputs).flatMap(([f, v]) => v.imports.filter(i => i.external || i.path.startsWith('node:')).map(i => `${f} -> ${i.path}`));
  assert.deepEqual(bad, []);
});

test('Chromium draws a swimlane, a CRT, an FRT, a gantt and a cloud through the bundle, measured on a canvas', async t => {
  const {chromium} = await import('playwright-chromium');
  let browser;
  try { browser = await chromium.launch(); } catch (e) { t.skip(`no Chromium: ${(e as Error).message.split('\n')[0]}`); return; }
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-entry-'));
    const out = path.join(dir, 'page.js');
    await build({entryPoints: [path.join(ROOT, 'test/fixtures/web-smoke.ts')], bundle: true, platform: 'browser', format: 'iife', outfile: out, logLevel: 'silent'});
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({content: fs.readFileSync(out, 'utf8')});
    const got = await page.evaluate(() => (globalThis as any).drawAll()) as Record<string, {ok: boolean; xml: string[]; svg: number; verdict: unknown}>;
    assert.deepEqual(Object.keys(got), ['swimlane', 'crt', 'frt', 'gantt', 'cloud']);
    for (const [name, r] of Object.entries(got)) { assert.equal(r.ok, true, `${name}: ${JSON.stringify(r.verdict)}`); assert.deepEqual(r.xml, [], name); assert.ok(r.svg > 1000, name); }
    // svgMeasurer returns the box the page itself gives a <text> (canvasMeasurer is a fraction of a pixel off for mono, and short for emoji / CJK fallbacks)
    for (const [t, size, weight, font] of [['Hello svg-diagram', 14, 400, 'mono'], ['受注する (DE) 😀', 16, 700, 'sans'], ['AV WAVE', 16, 700, 'emoji']] as const) {
      const r = await page.evaluate(([a, b, c, d]) => (globalThis as any).bboxOf(a, b, c, d), [t, size, weight, font] as const) as {via: {w: number; h: number}; drawn: {w: number; h: number}};
      assert.deepEqual(r.via, r.drawn, t);
    }
    // a space is a run of its own for the layout: it must have a width, and the phrase is its words and the space
    const sp = await page.evaluate(() => (globalThis as any).spaceProbe()) as {space: number; phrase: number; parts: number};
    assert.ok(sp.space > 2, `a lone space has width (got ${sp.space})`);
    // kerning between a letter and the space can move the sum by a pixel (CI's fonts do); a space measured as 0 would be off by the whole space
    assert.ok(Math.abs(sp.phrase - sp.parts) < sp.space / 2, `'Hello world' ${sp.phrase} vs the parts ${sp.parts}`);
    const st = await page.evaluate(() => (globalThis as any).styledProbe()) as {styled: number; plain: number};
    assert.equal(st.styled, st.plain, "the page's letter-spacing is not taken");
    assert.match(await page.evaluate(() => (globalThis as any).hiddenHost()) as string, /measured nothing/);
    const rule = await page.evaluate(() => (globalThis as any).pageRuleProbe()) as {before: number; after: number};
    assert.equal(rule.after, rule.before, "a page rule on text {} does not change the measured width");
  } finally { await browser.close(); }
});
