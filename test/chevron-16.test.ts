// B4: a chevron takes up to 16 steps (wrapped with rows / perRow); 16 steps on a 16:9 slide stay readable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {closeMeasurer} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {specToDiagram} from '../lib/spec.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const cfg = {measure: 'font' as const, fonts: JA_FONTS};
configureMeasure(cfg);
test.after(() => closeMeasurer());

const steps = (n: number, ja: boolean) => Array.from({length: n}, (_, i) => ({label: ja ? `工程${i + 1}` : `Stage ${i + 1}`, sub: ja ? '確認する' : 'check it'}));
const fig = (n: number, extra: object = {}, ja = true) => ({version: 1, title: 't', parts: [{type: 'chevron', steps: steps(n, ja), ...extra}]});

test('a chevron of 16 steps is accepted, 17 is not', () => {
  assert.doesNotThrow(() => specToDiagram(fig(16, {rows: 'auto'})));
  assert.doesNotThrow(() => specToDiagram(fig(13, {rows: 3})));
  assert.throws(() => specToDiagram(fig(17, {rows: 'auto'})));
  assert.throws(() => specToDiagram(fig(16, {current: 17, rows: 'auto'})));
  assert.doesNotThrow(() => specToDiagram(fig(16, {current: 16, rows: 'auto'})));
});

test('16 steps with rows: auto draw on a 16:9 slide without errors (Japanese and Latin), in at most 4 rows', async () => {
  for (const ja of [true, false]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chev16-')), file = path.join(dir, 'deck.json');
    fs.writeFileSync(file, JSON.stringify({slides: [{title: 'S', figure: fig(16, {rows: 'auto'}, ja)}]}));
    const r = loadDeck(file);
    assert.ok(r.ok);
    const out = await renderDeck(r.loaded, cfg);
    fs.rmSync(dir, {recursive: true, force: true});
    assert.deepEqual(out.errors, [], `ja=${ja}`);
    const svg = String((out.slides[0] as {svg?: string}).svg ?? '');
    const arrows = (svg.match(/marker-end/g) ?? []).length;
    assert.ok(arrows >= 1 && arrows <= 3, `row-continuation arrows: ${arrows}`);
    assert.ok(svg.includes(ja ? '工程16' : 'Stage 16'));
  }
});

test('16 long Latin steps with rows: 2 on a 16:9 slide are reported (a word wider than its arrow), rows: auto is not', async () => {
  const words = ['Preparation', 'Implementation', 'Stabilization', 'Retrospective'];
  const long = Array.from({length: 16}, (_, i) => ({label: `${words[i % 4]}`, sub: 'owner and due date'}));
  const run = async (extra: object) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chev16w-')), file = path.join(dir, 'deck.json');
    fs.writeFileSync(file, JSON.stringify({slides: [{title: 'S', figure: {version: 1, title: 't', parts: [{type: 'chevron', steps: long, ...extra}]}}]}));
    const r = loadDeck(file);
    assert.ok(r.ok);
    const out = await renderDeck(r.loaded, cfg);
    fs.rmSync(dir, {recursive: true, force: true});
    return out.errors;
  };
  const errs = await run({rows: 2});
  assert.ok(errs.length > 0 && errs.some(e => /矢羽根に収まらない/.test(JSON.stringify(e))), JSON.stringify(errs));
  assert.deepEqual(await run({rows: 'auto'}), []);
});

test("rows: 'auto' counts a word wider than its arrow (it picks fewer steps a row); the default one-row layout warns instead of throwing", async () => {
  const {chevron, checkDiagram, diagram} = await import('../lib/dsl.ts');
  const check = async (steps: {label: string; sub?: string}[], opts: object) => (await checkDiagram(diagram({theme: 'blue', title: 't', width: 940}).add(chevron(steps, opts)))).verdict;
  const auto = Array.from({length: 16}, (_, i) => ({label: i === 5 ? 'Internationalization' : 'Step'}));
  const a = await check(auto, {rows: 'auto'});
  assert.deepEqual(a.problems, []);
  assert.deepEqual(a.warnings, [], 'auto found a 4-per-row layout that fits the word');
  const words = ['Requirements', 'Implementation', 'Stabilization', 'Retrospective', 'Deployment', 'Verification'].map(label => ({label}));
  const d = await check(words, {});
  assert.deepEqual(d.problems, []);
  assert.ok(d.warnings.some(w => /矢羽根より広い（語を短く・図を広く・perRow を減らす）/.test(w)), 'default layout warns');
  const v = await check([{label: 'Internationalization-and-localization-readiness-review'}], {direction: 'vertical'});
  assert.ok(!v.warnings.some(w => /矢羽根より広い/.test(w)), 'a vertical chevron takes no rows / perRow advice');
  await assert.rejects(checkDiagram(diagram({theme: 'blue', title: 't', width: 940}).add(chevron(words, {rows: 1}))), /矢羽根に収まらない/);
});

test('the overflow error names the Nth step', async () => {
  const {chevron, checkDiagram, diagram} = await import('../lib/dsl.ts');
  await assert.rejects(checkDiagram(diagram({theme: 'blue', title: 't', width: 940}).add(chevron([{label: 'Step'}, {label: 'Internationalization'}, {label: 'Step'}, {label: 'Step'}, {label: 'Step'}, {label: 'Step'}, {label: 'Step'}, {label: 'Step'}], {perRow: 8}))), /2 番目のステップ/);
});
