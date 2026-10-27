// ADR 0045: the browser entry (lib/web.ts) draws a figure with a measurer the page gives, and nothing it reaches needs node:*.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {detachData} from '../lib/dsl/diagram.ts';
import {canvasMeasurer} from '../lib/web-measure.ts';
import {causeTree, cloud, diagram, image, math, renderInBrowser} from '../lib/web.ts';

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

test('Chromium draws a swimlane, a CRT, an FRT and a cloud through the bundle, measured on a canvas', async t => {
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
    assert.deepEqual(Object.keys(got), ['swimlane', 'crt', 'frt', 'cloud']);
    for (const [name, r] of Object.entries(got)) { assert.equal(r.ok, true, `${name}: ${JSON.stringify(r.verdict)}`); assert.deepEqual(r.xml, [], name); assert.ok(r.svg > 1000, name); }
  } finally { await browser.close(); }
});
