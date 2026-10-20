// How measure.ts picks its engine and how that choice reaches it: configureMeasure(), SVG_DIAGRAM_MEASURE, .svg-diagram.json
// (`measure`, `fonts`), loadDiagram(), and the cache that must not mix engines or font settings.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {configureMeasure, currentMeasure, measureAll, closeMeasurer} from '../lib/measure.ts';
import {resolveFontFile} from '../lib/font-metrics.ts';
import {loadConfig} from '../lib/config.ts';
import {loadDiagram} from '../lib/load-source.ts';
import type {MeasureRequest} from '../lib/types/core.ts';
import type {FontSpecs} from '../lib/types/project.ts';

const sansFile = resolveFontFile('sans');
const monoFile = resolveFontFile('mono');
const needFonts = sansFile && monoFile ? false : 'no sans/mono font file found';

const savedEnv = process.env['SVG_DIAGRAM_MEASURE'];
const req = (text: string, size = 16) => new Map<string, MeasureRequest>([['k', {text, size, weight: 400, font: 'sans'}]]);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'measure-config-'));

test.beforeEach(() => { delete process.env['SVG_DIAGRAM_MEASURE']; });
test.afterEach(() => { delete process.env['SVG_DIAGRAM_MEASURE']; configureMeasure({}); });
test.after(async () => {
  if (savedEnv === undefined) delete process.env['SVG_DIAGRAM_MEASURE']; else process.env['SVG_DIAGRAM_MEASURE'] = savedEnv;
  await closeMeasurer();
});

test('unset: the font files, chosen by default', () => {
  configureMeasure({});
  assert.deepEqual(currentMeasure(), {backend: 'font', explicit: false});
});

test('`measure` in the config is an explicit choice, either way', () => {
  configureMeasure({measure: 'chromium'});
  assert.deepEqual(currentMeasure(), {backend: 'chromium', explicit: true});
  configureMeasure({measure: 'font'});
  assert.deepEqual(currentMeasure(), {backend: 'font', explicit: true});
});

test('SVG_DIAGRAM_MEASURE wins over the config', () => {
  process.env['SVG_DIAGRAM_MEASURE'] = 'chromium';
  configureMeasure({measure: 'font'});
  assert.deepEqual(currentMeasure(), {backend: 'chromium', explicit: true});
  process.env['SVG_DIAGRAM_MEASURE'] = 'font';
  configureMeasure({measure: 'chromium'});
  assert.deepEqual(currentMeasure(), {backend: 'font', explicit: true});
});

test('an SVG_DIAGRAM_MEASURE that is neither engine is refused, naming the value', () => {
  process.env['SVG_DIAGRAM_MEASURE'] = 'browser';
  assert.throws(() => configureMeasure({}), /SVG_DIAGRAM_MEASURE=browser.*'chromium' or 'font'/);
});

test('an empty SVG_DIAGRAM_MEASURE counts as unset', () => {
  process.env['SVG_DIAGRAM_MEASURE'] = '';
  configureMeasure({});
  assert.deepEqual(currentMeasure(), {backend: 'font', explicit: false});
});

test('nothing to measure costs nothing: no config is read, no engine started', async () => {
  const out = await measureAll(new Map());
  assert.equal(out.size, 0);
});

test('.svg-diagram.json carries `measure` and `fonts`, found from a parent directory', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({measure: 'font', fonts: {sans: {regular: '/x/a.ttf#2', bold: '/x/b.ttf'}}, maxWidth: 800}));
  fs.mkdirSync(path.join(dir, 'a', 'b'), {recursive: true});
  const cfg = loadConfig(path.join(dir, 'a', 'b'));
  assert.equal(cfg.measure, 'font');
  assert.deepEqual(cfg.fonts, {sans: {regular: '/x/a.ttf#2', bold: '/x/b.ttf'}});
  assert.equal(cfg.maxWidth, 800);
  fs.rmSync(dir, {recursive: true});
});

test('the first measurement with nothing configured reads the config from the current directory', async (t) => {
  if (needFonts) return t.skip(needFonts);
  const dir = tmp();
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify({fonts: {sans: {regular: '/no/such/font.ttf'}}, measure: 'font'}));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    // unconfigured (afterEach left it configured, so reset the module state through a fresh import)
    const fresh = await import(`../lib/measure.ts?cwd=${Date.now()}`);
    await assert.rejects(fresh.measureAll(req('x')), /font\.ttf/);
  } finally { process.chdir(cwd); fs.rmSync(dir, {recursive: true}); }
});

test('the cache does not mix font settings: the same text measured with a different font gives a different width', async (t) => {
  if (needFonts) return t.skip(needFonts);
  const proportional: FontSpecs = {sans: {regular: `${sansFile!.file}#${sansFile!.index}`}};
  const monospaced: FontSpecs = {sans: {regular: `${monoFile!.file}#${monoFile!.index}`}};
  const text = 'Inventory lillii MMMMM';
  configureMeasure({measure: 'font', fonts: proportional});
  const a = (await measureAll(req(text))).get('k')!.w;
  configureMeasure({measure: 'font', fonts: monospaced});
  const b = (await measureAll(req(text))).get('k')!.w;
  configureMeasure({measure: 'font', fonts: proportional});
  const c = (await measureAll(req(text))).get('k')!.w;
  assert.notEqual(a, b);
  assert.equal(a, c);
});

test('the cache does not mix engines', async (t) => {
  if (needFonts) return t.skip(needFonts);
  const monospaced: FontSpecs = {sans: {regular: `${monoFile!.file}#${monoFile!.index}`}};
  const text = 'Inventory lillii MMMMM';
  configureMeasure({measure: 'font', fonts: monospaced});
  const fromFont = (await measureAll(req(text))).get('k')!.w;
  configureMeasure({measure: 'chromium'});
  const fromChromium = (await measureAll(req(text))).get('k')!.w;
  configureMeasure({measure: 'font', fonts: monospaced});
  assert.equal((await measureAll(req(text))).get('k')!.w, fromFont);
  // Chromium measures the real sans stack, not the mono file the font engine was pointed at
  assert.ok(Math.abs(fromChromium - fromFont) > 1, `${fromChromium} vs ${fromFont}`);
});

test('the cache does not hand a font-engine value to the Chromium engine (the browser really is asked)', (t) => {
  if (needFonts) return t.skip(needFonts);
  // a child process whose Chromium cannot start: measuring the same text with the Chromium engine must fail, not answer from the cache
  const dir = tmp();
  const script = path.join(dir, 'probe.ts');
  const measure = path.resolve(import.meta.dirname, '..', 'lib', 'measure.ts');
  fs.writeFileSync(script, `
    import {configureMeasure, measureAll} from ${JSON.stringify(measure)};
    const req = new Map([['k', {text: 'cache-engine-probe', size: 19, weight: 400, font: 'sans'}]]);
    configureMeasure({measure: 'font'});
    const fromFont = (await measureAll(req)).get('k').w;
    configureMeasure({measure: 'chromium'});
    try { await measureAll(req); console.log('ANSWERED'); } catch (e) { console.log('REFUSED ' + fromFont); }
  `);
  const r = spawnSync(process.execPath, [script], {encoding: 'utf8', env: {...process.env, PLAYWRIGHT_BROWSERS_PATH: '/nonexistent', SVG_DIAGRAM_MEASURE: ''}});
  assert.match(r.stdout, /^REFUSED [0-9.]+/, r.stdout + r.stderr);
  fs.rmSync(dir, {recursive: true});
});

test('measure unset, no font file: warns once and measures in Chromium; measure "font": throws', async (t) => {
  if (needFonts) return t.skip(needFonts);
  const bad: FontSpecs = {sans: {regular: '/no/such/font.ttf'}};
  const seen: string[] = [];
  const warn = console.warn; console.warn = (m: string) => { seen.push(String(m)); };
  try {
    configureMeasure({fonts: bad});
    const first = await measureAll(req('fallback text one', 15));
    const second = await measureAll(req('fallback text two', 15));
    assert.ok(first.get('k')!.w > 0 && second.get('k')!.w > 0);
    assert.equal(seen.length, 1, seen.join('\n'));
    assert.match(seen[0]!, /measuring with Chromium instead/);
    assert.equal(currentMeasure().backend, 'chromium');
    configureMeasure({measure: 'font', fonts: bad});
    await assert.rejects(measureAll(req('hard error', 15)), /font\.ttf/);
  } finally { console.warn = warn; }
});

test('loadDiagram applies the config it is given to measuring', async (t) => {
  if (needFonts) return t.skip(needFonts);
  const dir = tmp();
  const src = path.join(dir, 'd.ts');
  fs.writeFileSync(src, `import {diagram, box} from 'svg-diagram';\nexport default function define() { return diagram({theme: 'blue'}).add(box({title: 'a'})); }\n`);
  const {register} = await import('node:module');
  register(new URL('../lib/resolve-hook.ts', import.meta.url));
  await loadDiagram(src, {measure: 'font', fonts: {sans: {regular: '/no/such/font.ttf'}}});
  assert.equal(currentMeasure().backend, 'font');
  await assert.rejects(measureAll(req('after loadDiagram', 17)), /font\.ttf/);
  await loadDiagram(src, {measure: 'chromium'});
  assert.equal(currentMeasure().backend, 'chromium');
  fs.rmSync(dir, {recursive: true});
});
