// The browser without playwright (lib/cdp-browser.ts): found where Python's playwright puts it, and driven over the DevTools protocol.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {findChromium, launchCdp} from '../lib/cdp-browser.ts';

test('findChromium: SVG_DIAGRAM_CHROMIUM wins; else the newest playwright download, the full browser before the headless shell', () => {
  assert.equal(findChromium({SVG_DIAGRAM_CHROMIUM: '/x/chrome'}), '/x/chrome');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-cache-'));
  const put = (rel: string) => { fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true}); fs.writeFileSync(path.join(root, rel), ''); };
  put('chromium-1200/chrome-linux/chrome');
  put('chromium-1228/chrome-linux64/chrome');
  put('chromium_headless_shell-1300/chrome-linux/headless_shell');
  assert.equal(findChromium({PLAYWRIGHT_BROWSERS_PATH: root, PATH: ''}), path.join(root, 'chromium-1228', 'chrome-linux64', 'chrome'));
  fs.rmSync(path.join(root, 'chromium-1228'), {recursive: true});
  fs.rmSync(path.join(root, 'chromium-1200'), {recursive: true});
  assert.equal(findChromium({PLAYWRIGHT_BROWSERS_PATH: root, PATH: ''}), path.join(root, 'chromium_headless_shell-1300', 'chrome-linux', 'headless_shell'));
  fs.rmSync(root, {recursive: true});
});

test('a page over the protocol: setContent, evaluate with an argument, a rejected promise, close', async t => {
  if (!findChromium()) { t.skip('no Chromium on this machine'); return; }
  const browser = await launchCdp({args: ['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport: {width: 400, height: 300}});
    await page.setContent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text id="t" y="20" font-size="16">abc</text></svg>');
    assert.deepEqual(await page.evaluate(({id, k}: {id: string; k: number}) => {
      const b = (document.getElementById(id) as unknown as SVGGraphicsElement).getBBox();
      return {w: b.width > 0, k, vw: innerWidth};
    }, {id: 't', k: 7}), {w: true, k: 7, vw: 400});
    assert.equal(await page.evaluate(async () => { await new Promise(r => setTimeout(r, 20)); return 'late'; }), 'late');
    await assert.rejects(page.evaluate(() => { throw new Error('boom'); }), /boom/);
    assert.equal(await page.locator('text').count(), 1);
    await page.close();
  } finally { await browser.close(); }
});

test('with no playwright package, measuring and lint --engine browser go through it', async t => {
  if (!findChromium()) { t.skip('no Chromium on this machine'); return; }
  const {spawnSync} = await import('node:child_process');
  const ROOT = path.resolve(import.meta.dirname, '..');
  const BLOCK = path.join(import.meta.dirname, 'helpers', 'block-playwright-register.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-build-'));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'build-diagram.ts'), path.join(ROOT, 'examples', 'inventory-flow.ts'), '--out', path.join(dir, 'f.svg')],
    {cwd: ROOT, encoding: 'utf8', env: {...process.env, SVG_DIAGRAM_MEASURE: 'chromium', SVG_DIAGRAM_BROWSER: 'auto', NODE_OPTIONS: `--import ${new URL(`file://${BLOCK}`).href}`}});
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(fs.readFileSync(path.join(dir, 'f.svg'), 'utf8'), /^<svg\b/);
  fs.rmSync(dir, {recursive: true});
});
