// ADR 0074 U1, criterion 1: the comic is the same SVG, atom positions included, when Node (HarfBuzz) draws it and when Chromium draws it through the
// browser entry with its own measurer. A full-width atom is never measured, so the match is exact for full-width text.
import {test} from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {comic, diagram, renderDiagram, closeMeasurer} from '../lib/dsl.ts';
import {SAMPLE} from './helpers/comic-sample.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
/** The `<g data-comic>` element, found by counting the <g> and </g> inside it. */
const fragment = (svg: string): string => {
  const start = svg.indexOf('<g data-comic=');
  let depth = 0;
  for (const m of svg.slice(start).matchAll(/<g[ >]|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(start, start + m.index! + 4);
  }
  return '';
};

test.after(() => closeMeasurer());

test('the comic is drawn as the same SVG by Node and by Chromium through lib/web.ts (every atom position)', async t => {
  const {chromium} = await import('playwright-chromium');
  let browser;
  try { browser = await chromium.launch(); } catch (e) { t.skip(`no Chromium: ${(e as Error).message.split('\n')[0]}`); return; }
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comic-web-'));
    const out = path.join(dir, 'page.js');
    await build({entryPoints: [path.join(ROOT, 'test/fixtures/comic-smoke.ts')], bundle: true, platform: 'browser', format: 'iife', outfile: out, logLevel: 'silent'});
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({content: fs.readFileSync(out, 'utf8')});
    const got = await page.evaluate(() => (globalThis as any).drawComic()) as {ok: boolean; xml: string[]; svg: string};
    const node = await renderDiagram(diagram({theme: 'blue', title: 'マンガ', width: 480, legend: false}).add(comic(SAMPLE)), {name: 'c', budget: 'cacheOnly'});
    assert.equal(got.ok, true);
    assert.deepEqual(got.xml, []);
    const a = fragment(got.svg), b = fragment(node.svg);
    assert.ok(a.length > 3000 && a.includes('data-bubble="p2.d2"'), 'the fragment was found');
    assert.equal(a, b);
  } finally { await browser.close(); }
});
