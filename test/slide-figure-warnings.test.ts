// Advisory rules that are noise on a slide figure or on a figure that already tells its items apart by more than colour:
// doc-width (not for a slide figure), gray-tone-collision / legend-missing (not when a shape, dash or word does the telling).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {box, checkDiagram, closeMeasurer, connect, diagram} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-warn-'));
test.after(async () => { fs.rmSync(dir, {recursive: true, force: true}); await closeMeasurer(); });

const rules = async (d: ReturnType<typeof diagram>) => (await checkDiagram(d)).verdict.findings.filter(f => f.severity === 'warn').map(f => f.rule);

// ---- doc-width ----
const wide = (extra: object = {}) => diagram({theme: 'blue', title: 't', legend: false, width: 1200, ...extra}).add(box({title: 'a'}));

test('doc-width: a plain document figure still gets it (control)', async () => {
  assert.ok((await rules(wide())).includes('doc-width'));
});

test('doc-width: a slide figure with its own width (no fill) still gets it (control)', async () => {
  assert.ok((await rules(wide({slide: {page: 'p', heading: 'h'}}))).includes('doc-width'));
});

test('doc-width: a figure built to its slide slot (slide + fill) does not', async () => {
  assert.ok(!(await rules(wide({slide: {page: 'p', heading: 'h'}, fill: true}))).includes('doc-width'));
});

test('doc-width: a canvas figure does not (unchanged)', async () => {
  assert.ok(!(await rules(wide({width: undefined, canvas: 'slide'}))).includes('doc-width'));
});

const deckWith = (width: number) => {
  fs.writeFileSync(path.join(dir, `fig-${width}.diagram.ts`), `import {box, diagram} from 'svg-diagram';
export default function define() {
  return diagram({theme: 'blue', title: 't', legend: false, width: ${width}}).add(box({title: 'a'}));
}\n`);
  const f = path.join(dir, `deck-${width}.json`);
  fs.writeFileSync(f, JSON.stringify({slides: [{title: 'A', figure: `fig-${width}.diagram.ts`}]}));
  const r = loadDeck(f); assert.ok(r.ok);
  return renderDeck(r.loaded, cfg);
};

test('doc-width: a deck slide figure (.ts source) does not get it, however wide', async () => {
  const out = await deckWith(1200);
  assert.deepEqual(out.errors, []);
  assert.equal(out.warnings.filter(w => w.includes('doc-width')).length, 0, JSON.stringify(out.warnings));
});

test('doc-width: a deck slide spec figure does not get it under a narrower project maxWidth', async () => {
  const fig = {version: 1, title: '流れ', parts: [{type: 'flowchart', nodes: [{id: 'a', label: '入口'}, {id: 'b', label: '出口'}], edges: [{from: 'a', to: 'b'}]}]};
  const f = path.join(dir, 'deck-spec.json');
  fs.writeFileSync(f, JSON.stringify({slides: [{title: 'A', figure: fig}]}));
  const r = loadDeck(f); assert.ok(r.ok);
  const out = await renderDeck(r.loaded, {...cfg, maxWidth: 400});
  assert.equal(out.warnings.filter(w => w.includes('doc-width')).length, 0, JSON.stringify(out.warnings));
});

// ---- gray-tone-collision ----
const pair = (a: object, b: object) => diagram({theme: 'blue', title: 't', legend: false}).add(box({id: 'a', title: 'a', ...a}), box({id: 'b', title: 'b', tone: 'accent', ...b}));

test('gray-tone-collision: plain next to accent with nothing else to tell them apart still fires (control)', async () => {
  assert.ok((await rules(pair({}, {}))).includes('gray-tone-collision'));
});

test('gray-tone-collision: one side drawn dashed, the other solid, does not fire', async () => {
  assert.ok(!(await rules(pair({}, {dashed: true}))).includes('gray-tone-collision'));
});

test('gray-tone-collision: both sides dashed still fires (control)', async () => {
  assert.ok((await rules(pair({dashed: true}, {dashed: true}))).includes('gray-tone-collision'));
});

// ---- legend-missing ----
const lines = (a: object, b: object) => diagram({theme: 'blue', title: 't'}).add(
  box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'}), box({id: 'c', title: 'c'}),
  connect('a', 'b', {line: 'dashed', ...a}), connect('b', 'c', {line: 'dashed', ...b}));

test('legend-missing: a dashed line without a legend still fires (control)', async () => {
  assert.ok((await rules(lines({}, {}))).includes('legend-missing'));
});

test('legend-missing: every dashed line shares one label (it names the style), so it does not fire', async () => {
  assert.ok(!(await rules(lines({label: '非同期'}, {label: '非同期'}))).includes('legend-missing'));
});

test('legend-missing: a single labelled dashed line still fires (it cannot be told from a value label) (control)', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'}), connect('a', 'b', {line: 'dashed', label: '非同期'}));
  assert.ok((await rules(d)).includes('legend-missing'));
});

test('legend-missing: value labels that differ per line (solid, dashed and dotted each labelled) do not explain the styles (control)', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'}), box({id: 'c', title: 'c'}), box({id: 'd', title: 'd'}),
    connect('a', 'b', {label: '3 件'}), connect('b', 'c', {line: 'dashed', label: '5 件'}), connect('c', 'd', {line: 'dotted', label: '2 件'}));
  assert.ok((await rules(d)).includes('legend-missing'));
  assert.ok((await rules(lines({label: '5 件'}, {label: '7 件'}))).includes('legend-missing'), 'two dashed lines with different labels');
});

test('legend-missing: one unlabelled dashed line keeps it firing (control)', async () => {
  assert.ok((await rules(lines({label: '非同期'}, {}))).includes('legend-missing'));
});

test('legend-missing: a labelled strong arrow is still reported for its weight (control)', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'}), connect('a', 'b', {weight: 'strong', label: '主流'}));
  assert.ok((await rules(d)).includes('legend-missing'));
});


test('gray-tone-collision / legend-missing: a tag is not read as an explanation of the tone (canvas puts its region name there) (control)', async () => {
  assert.ok((await rules(pair({tag: 'A 群'}, {tag: 'B 群'}))).includes('gray-tone-collision'));
  const d = diagram({theme: 'blue', title: 't'}).add(box({id: 'a', title: 'a', tone: 'danger', tag: 'リスク'}));
  assert.ok((await rules(d)).includes('legend-missing'));
});

test('gray-tone-collision: a tone with both dashed and solid boxes shares an outline with the other, so it still fires (control)', async () => {
  const d = pair({dashed: true}, {}).add(box({id: 'c', title: 'c'}));
  assert.ok((await rules(d)).includes('gray-tone-collision'));
});

test('gray-tone-collision: dashed on solid / solid-danger (no outline of their own: the dashes are drawn in the fill colour) does not tell them apart (control)', async () => {
  const mk = (extra: object) => diagram({theme: 'blue', title: 't', legend: false}).add(box({id: 'a', title: 'a', tone: 'solid', ...extra}), box({id: 'b', title: 'b', tone: 'solid-danger'}));
  const base = (await rules(mk({}))).includes('gray-tone-collision');
  assert.ok(base, 'fires without dashed');
  assert.ok((await rules(mk({dashed: true}))).includes('gray-tone-collision'));
});
