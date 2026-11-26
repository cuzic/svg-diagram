// decisionLadder in a JSON spec (ADR 0083 U2): it builds the figure the DSL builds, the schema rejects what the DSL rejects, and the example draws on a deck slide.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkDiagram, closeMeasurer, decisionLadder, diagram} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {partCatalog, specSchema, specToDiagram, validateSpec} from '../lib/spec.ts';
import type {LaidOutStates} from '../lib/types/diagrams.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ladder-spec-'));
test.after(async () => { fs.rmSync(dir, {recursive: true, force: true}); await closeMeasurer(); });

const STEPS = [
  {q: '貸出票は書いてある？', yes: '窓口で受け付ける'},
  {q: '返却期限は守れる？', yes: '貸出の手続きに進む', yesLabel: 'ある', noLabel: 'ない'},
  {q: '次回の入荷を待てる？', yes: '入荷の連絡を登録する', sub: '7 日間有効', tone: 'accent' as const},
];
const spec = (part: object, extra: object = {}) => ({version: 1, title: 't', width: 640, ...extra, parts: [{type: 'decisionLadder', ...part}]});
const band = async (d: ReturnType<typeof diagram>) => (await checkDiagram(d)).laidOut.laidOut.find((b): b is LaidOutStates => b.type === 'states')!;
const strip = (b: LaidOutStates) => JSON.stringify({...b, id: undefined});

test('a spec draws exactly what the DSL draws, for the options too', async () => {
  for (const opts of [{}, {yes: 'Yes', no: 'No'}, {question: 'diamond'}, {yes: '', no: ''}] as const) {
    for (const otherwise of ['後日の来館をお願いする', {label: '後日の来館をお願いする', sub: '予約は不要', tone: 'muted' as const}]) {
      const fromSpec = await band(specToDiagram(spec({steps: STEPS, otherwise, ...opts})));
      const fromDsl = await band(diagram({theme: 'blue', title: 't', width: 640}).add(decisionLadder(STEPS, otherwise, opts)));
      assert.equal(strip(fromSpec), strip(fromDsl), JSON.stringify(opts));
    }
  }
});

test('the part is in the catalog, its example validates, and its anchors are q1..qN, a1..aN and otherwise', () => {
  const p = partCatalog().find(x => x.type === 'decisionLadder');
  assert.ok(p);
  assert.deepEqual(validateSpec({version: 1, title: 't', parts: [p.example]}), []);
  assert.deepEqual(validateSpec(spec({steps: [{q: 'a?', yes: 'b', sub: ''}], otherwise: {label: 'c', sub: ''}})), [], "sub: '' is accepted as the DSL does");
  assert.match(partCatalog().find(x => x.type === 'flowchart')!.description, /decisionLadder/);
  const two = validateSpec({version: 1, title: 't', parts: [{type: 'decisionLadder', steps: STEPS, otherwise: 'x'}, {type: 'decisionLadder', steps: STEPS, otherwise: 'y'}]});
  const ids = ['q1', 'a1', 'q2', 'a2', 'q3', 'a3', 'otherwise'];
  assert.deepEqual(two.map(i => i.path).sort(), [...ids.slice(0, 6).map((_, k) => `parts[1].steps[${Math.floor(k / 2)}]`), 'parts[1].otherwise'].sort(), JSON.stringify(two));
  assert.deepEqual(two.map(i => /"(\w+)"/.exec(i.message)![1]).sort(), [...ids].sort());
  assert.ok(two.every(i => /one ladder|holds one/.test(i.message)), 'the message says a spec holds one ladder');
  for (const id of ['a1', 'otherwise', 'q2']) {
    const clash = validateSpec({version: 1, title: 't', parts: [{type: 'flowchart', nodes: [{id, label: 'x'}], edges: []}, {type: 'decisionLadder', steps: STEPS, otherwise: 'x'}]});
    assert.equal(clash.length, 1, `${id}: ${JSON.stringify(clash)}`);
    assert.match(clash[0]!.message, new RegExp(`"${id}" is already used in parts\\[0\\]`));
  }
  assert.ok(JSON.stringify(specSchema).includes('decisionLadder'));
});

test('the schema rejects what the DSL rejects, with the place', () => {
  const bad = (part: object): string => validateSpec(spec(part)).map(i => `${i.path}: ${i.message}`).join('\n');
  assert.match(bad({steps: [], otherwise: 'x'}), /steps/);
  assert.match(bad({steps: STEPS}), /otherwise/);
  assert.match(bad({steps: Array.from({length: 13}, () => STEPS[0]), otherwise: 'x'}), /steps/);
  assert.match(bad({steps: [{q: 'a?'}], otherwise: 'x'}), /steps\[0\]\.yes/);
  assert.match(bad({steps: [{q: 'a?', yes: 'b', extra: 1}], otherwise: 'x'}), /steps\[0\]\.extra|extra/);
  assert.match(bad({steps: STEPS, otherwise: 'x', question: 'hexagon'}), /question/);
  assert.match(bad({steps: STEPS, otherwise: {label: 'x', foo: 1}}), /otherwise/);
  assert.match(bad({steps: STEPS, otherwise: 'x', dir: 'right'}), /dir/);
  assert.match(bad({steps: STEPS, otherwise: 'x', yes: 3}), /yes/);
  assert.match(bad({steps: [{q: 'a?', yes: 'b', tone: 'loud'}], otherwise: 'x'}), /tone/);
});

test('the example passes check --strict-grade rules and renders on a deck slide with no errors', async () => {
  const mod = await import('../examples/decision-ladder.ts');
  const {verdict} = await checkDiagram(mod.default());
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(verdict.findings.filter(f => f.severity === 'warn'), []);
  const file = path.join(dir, 'deck.json');
  fs.copyFileSync(path.resolve(import.meta.dirname, '../examples/decision-ladder.ts'), path.join(dir, 'ladder.diagram.ts'));
  fs.writeFileSync(file, JSON.stringify({slides: [{title: '受け付けの判断', figure: 'ladder.diagram.ts'}, {title: 'spec で書く', figure: spec({steps: STEPS, otherwise: 'x'})}]}));
  const r = loadDeck(file);
  assert.ok(r.ok);
  const out = await renderDeck(r.loaded, cfg);
  assert.deepEqual(out.errors, []);
  assert.ok(out.slides.every(s => s !== null));
});
