// node spikes/comic-worksheet/browser-check.mjs [version]  — the artifact path: a plain HTML page imports svg-diagram/browser from jsDelivr,
// renders with svgMeasurer(), and runs the (esbuild-bundled) comic prototype with the same measurer. Needs network and a Chromium.
import {build} from 'esbuild';
import {chromium} from 'playwright-chromium';
import path from 'node:path';

const version = process.argv[2] ?? '0.9.0';
const here = import.meta.dirname;
const bundle = await build({entryPoints: [path.join(here, 'proto.ts')], bundle: true, format: 'iife', globalName: 'Proto', platform: 'browser', write: false});
const sample = await import(path.join(here, 'sample.ts'));
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(m.text()));
page.on('pageerror', e => logs.push(`pageerror: ${e.message}`));
page.on('requestfailed', r => logs.push(`requestfailed: ${r.url()}`));
await page.setContent('<!doctype html><meta charset=utf-8><body style="font-family:sans-serif"><div id=out></div>');
await page.addScriptTag({content: bundle.outputFiles[0].text});
const res = await page.evaluate(async ({version, ws}) => {
  const t0 = performance.now();
  const sd = await import(`https://cdn.jsdelivr.net/npm/svg-diagram@${version}/dist/lib/web.js`);
  const tImport = performance.now() - t0;
  const measure = sd.svgMeasurer();
  const r0 = performance.now();
  const d = sd.diagram({title: 'check', theme: 'blue'}).add(
    sd.row([sd.box({id: 'a', title: '週に一度は早く帰る'}), sd.box({id: 'b', title: '最近、早く帰るね'})]),
    sd.wordart('縦書きの見出し', {vertical: true}),
    sd.people(10, 3, {cols: 5}));
  const r = await sd.renderInBrowser(d, {measure});
  const tRender = performance.now() - r0;
  const exportsHave = ['callout', 'people', 'wordart', 'canvas', 'image', 'icon', 'renderInBrowser', 'svgMeasurer', 'reveal'].filter(k => k in sd);
  // the comic prototype with the browser's own measurer
  const widths = (text, size, weight = 400) => measure({text, size, weight, font: 'sans'}).w;
  const laid = Proto.layoutComic(ws, widths);
  const filled = {day: '水曜', what: '引継ぎ', prep: '資料を共有', change: '早く帰る', wish: '週に一度は早く帰る'};
  const svgs = [laid.svg({}), laid.svg(filled)];
  const nowMs = () => performance.now();
  let u0 = nowMs(); laid.svg({...filled, change: 'のんびりしている'}); const updateOne = nowMs() - u0; // one new value, real svgMeasurer
  u0 = nowMs(); laid.svg({day: '金曜', what: '残業', prep: '引き継ぎ表', change: '笑顔が増えた', wish: 'いい感じ'}); const updateFive = nowMs() - u0; // five new values
  document.getElementById('out').innerHTML = svgs[1];
  // SVG -> PNG in the page (canvas), the artifact's export path
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgs[1]], {type: 'image/svg+xml'}));
  await new Promise((ok, ng) => { img.onload = ok; img.onerror = ng; img.src = url; });
  const cv = document.createElement('canvas'); cv.width = laid.width * 2; cv.height = laid.height * 2;
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  const png = cv.toDataURL('image/png');
  let imageThrows = false; try { sd.image('x.png'); } catch { imageThrows = true; }
  return {updateOneMs: +updateOne.toFixed(2), updateFiveMs: +updateFive.toFixed(2), filledSvg: svgs[1], tImport: Math.round(tImport), tRender: Math.round(tRender), ok: r.verdict?.ok ?? r.verdict, svgBytes: r.svg.length, hasGeometry: Object.keys(r).filter(k => k !== 'svg'), laidOutBands: r.laidOut.laidOut.length, exportsHave, imageThrows, comicGeometry: laid.geometry, comicFindings: laid.findings, pngBytes: png.length, fontOk: await document.fonts.ready.then(() => true)};
}, {version, ws: sample.sample});
const nodeSvg = (await import('node:fs')).readFileSync(path.join(here, 'out/filled.svg'), 'utf8');
console.log('browser SVG identical to Node SVG (every atom position):', res.filledSvg === nodeSvg);
console.log(JSON.stringify({...res, filledSvg: undefined, comicGeometry: undefined, comicBubbles: Object.fromEntries(Object.entries(res.comicGeometry.bubbles).map(([k, r]) => [k, `${r.w}x${r.h}`]))}, null, 1));
console.log('logs:', logs.slice(0, 6));
await browser.close();
