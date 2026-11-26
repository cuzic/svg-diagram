// A figure's problems stop a deck (ADR 0056 D2, the same ones `build` and `check` stop at): renderDeck (a figure and auto-columns), `pptx-deck`
// (both paths) and the edge writer. (`accept` does not reach problems, here or in `check`.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {planFigureEdge} from '../lib/pptx-edge.ts';
import {renderDeckPptxEdgeWith} from '../lib/pptx-deck-edge-core.ts';
import {validateDeck} from '../lib/deck-spec.ts';
import {closeMeasurer} from '../lib/dsl.ts';
import {partCatalog} from '../lib/spec.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const ROOT = path.resolve(import.meta.dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-problems-'));
test.after(async () => { fs.rmSync(dir, {recursive: true, force: true}); await closeMeasurer(); });

// a 4x1 comic on an 800px diagram: comic-band-narrow (a problem)
const sheet = {version: 1, title: 't', layout: '4x1', cast: {me: {name: '私'}},
  panels: [1, 2, 3, 4].map(i => ({id: `p${i}`, stage: [{who: 'me', at: 'left', expression: 'neutral'}], dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: 'はい。'}]}))};
const figure = (name: string) => {
  fs.writeFileSync(path.join(dir, name), `import {comic, diagram} from 'svg-diagram';
export default function define() {
  return diagram({theme: 'blue', title: 'n', showTitle: false, legend: false, width: 800}).add(comic(${JSON.stringify(sheet)}));
}\n`);
};
figure('a.diagram.ts'); figure('b.diagram.ts');
const write = (name: string, slides: unknown[]) => { const f = path.join(dir, name); fs.writeFileSync(f, JSON.stringify({slides})); return f; };
const single = write('single.json', [{title: 'A', figure: 'a.diagram.ts'}]);
const cols = write('cols.json', [{title: 'C', columns: [{figure: 'a.diagram.ts'}, {figure: 'b.diagram.ts'}]}]);

const draw = async (file: string) => { const r = loadDeck(file); assert.ok(r.ok); return renderDeck(r.loaded, cfg); };

test('renderDeck: a figure with a problem is an error naming the rule, and the slide is not drawn', async () => {
  const out = await draw(single);
  assert.equal(out.slides[0], null);
  const e = out.errors.find(x => x.includes('comic-band-narrow'));
  assert.ok(e?.startsWith('slides[0].figure: '), JSON.stringify(out.errors));
  assert.match(out.errors[0]!, /^slides\[0\]\.figure: \d+ 個の問題があるので、このスライドを描かない/);
  assert.ok(out.errors.length > 1 && out.errors.every(x => x.startsWith('slides[0].figure: ')), 'one summary line, then the problems');
  assert.equal(out.errors.filter(x => x.includes('このスライドを描かない')).length, 1);
});

test('renderDeck: auto-columns report the problems of their figures at slides[i].columns[j].figure', async () => {
  const out = await draw(cols);
  assert.equal(out.slides[0], null);
  assert.ok(out.errors.some(x => x.startsWith('slides[0].columns[0].figure: ') && x.includes('comic-band-narrow')), JSON.stringify(out.errors));
  assert.ok(out.errors.some(x => x.startsWith('slides[0].columns[1].figure: ')));
});

const cli = (file: string) => spawnSync(process.execPath, [path.join(ROOT, 'pptx-deck-diagram.ts'), file, '--out', path.join(dir, 'o.pptx')], {encoding: 'utf8', cwd: ROOT});

test('pptx-deck: a figure with a problem stops the file (a figure, and chosen columns)', () => {
  for (const [file, place] of [[single, 'slides[0].figure'], [cols, 'slides[0].columns[0].figure']] as const) {
    fs.rmSync(path.join(dir, 'o.pptx'), {force: true});
    const r = cli(file);
    assert.notEqual(r.status, 0, r.stderr);
    assert.ok(r.stderr.includes(`${place}: `) && r.stderr.includes('comic-band-narrow'), r.stderr);
    assert.ok(!fs.existsSync(path.join(dir, 'o.pptx')));
  }
});

test('the edge writer: a figure with a problem comes back as an issue (a figure, and auto-columns)', async () => {
  const fig = {version: 1, title: 't', parts: [partCatalog().find(p => p.type === 'flowchart')?.example]};
  const services = {validate: (i: unknown) => validateDeck(i), plan: async (spec: unknown, engine: Parameters<typeof planFigureEdge>[1]) => {
    const f = await planFigureEdge(spec, engine);
    return 'issues' in f ? f : {...f, problems: ['the figure is broken [some-rule]']};
  }};
  const opts = {rasterize: () => new Uint8Array([0])};
  for (const [slide, place] of [[{figure: fig}, 'slides[0].figure'], [{columns: [{figure: fig}, {figure: fig}]}, 'slides[0].columns[0].figure']] as const) {
    const r = await renderDeckPptxEdgeWith({slides: [slide]}, realEngine(), opts, services);
    assert.equal(r.pptx, null);
    assert.ok(r.issues.some(i => i.path === place && /some-rule/.test(i.message)), JSON.stringify(r.issues));
  }
});

// ADR 0059 D3: with fit 'width' the deck lays a column figure out at the column's width; a problem that width brings is not an error (the figure is drawn at 940 and shrunk, with a warning)
const pert = {version: 1, title: 'pert', parts: [partCatalog().find(p => p.type === 'pert')?.example]};
const widthDeck = {fit: 'width', slides: [{title: 'P', columns: [{figure: pert}, {text: 'あ'}, {text: 'い'}]}]};

test('fit width: a problem only at the column\'s width falls back to 940 with a warning (renderDeck and pptx-deck)', async () => {
  const f = path.join(dir, 'width.json');
  fs.writeFileSync(f, JSON.stringify(widthDeck));
  const r = loadDeck(f);
  assert.ok(r.ok);
  const out = await renderDeck(r.loaded, cfg);
  assert.deepEqual(out.errors, []);
  assert.ok(out.warnings.some(w => w.startsWith('slides[0].columns[0].figure: ')), JSON.stringify(out.warnings));
  const c = cli(f);
  assert.equal(c.status, 0, c.stderr);
});

test('the edge writer: fit width falls back too; a problem at the figure\'s own width, or with fit width and a width of its own, is an issue', async () => {
  const real = {validate: (i: unknown) => validateDeck(i), plan: (spec: unknown, engine: Parameters<typeof planFigureEdge>[1]) => planFigureEdge(spec, engine)};
  const opts = {rasterize: () => new Uint8Array([0])};
  const fallback = await renderDeckPptxEdgeWith(widthDeck, realEngine(), opts, real);
  assert.deepEqual(fallback.issues, []);
  assert.ok(fallback.pptx);
  assert.ok(fallback.warnings.some(w => w.path === 'slides[0].columns[0].figure'));
  // a problem only while the spec has no width of its own (the deck's choice), then none at 940
  const withProblem = (bad: (spec: unknown) => boolean) => ({...real, plan: async (spec: unknown, engine: Parameters<typeof planFigureEdge>[1]) => {
    const f = await planFigureEdge(spec, engine);
    return 'issues' in f ? f : {...f, problems: bad(spec) ? ['broken [some-rule]'] : []};
  }});
  const hasWidth = (spec: unknown) => (spec as {width?: unknown}).width !== undefined;
  const soft = await renderDeckPptxEdgeWith(widthDeck, realEngine(), opts, withProblem(spec => hasWidth(spec) && (spec as {width: number}).width < 940));
  assert.deepEqual(soft.issues, []);
  assert.ok(soft.warnings.some(w => w.path === 'slides[0].columns[0].figure'));
  // fit width, and the figure's problem is its own at 940 too: an issue
  const hard = await renderDeckPptxEdgeWith(widthDeck, realEngine(), opts, withProblem(() => true));
  assert.equal(hard.pptx, null);
  assert.ok(hard.issues.some(i => i.path === 'slides[0].columns[0].figure' && i.message.includes('some-rule')), JSON.stringify(hard.issues));
});

// chat() bands raise problems the same way (chat-self-missing: the cast has no `me` and no `self` is given)
test('renderDeck: a chat with a problem stops the slide; an ordinary chat (examples/chat-draft.ts) draws with no errors', async () => {
  fs.writeFileSync(path.join(dir, 'chat-bad.diagram.ts'), `import {chat, diagram} from 'svg-diagram';
export default function define() {
  return diagram({theme: 'blue', title: 'c', showTitle: false, legend: false, width: 520}).add(chat({version: 1, title: 'c', cast: {a: {name: '甲'}, b: {name: '乙'}},
    dialogue: [{id: 'd1', who: 'a', kind: 'say', tpl: 'こんにちは。'}, {id: 'd2', who: 'b', kind: 'say', tpl: 'どうも。'}]}));
}\n`);
  fs.copyFileSync(path.join(ROOT, 'examples/chat-draft.ts'), path.join(dir, 'chat-ok.diagram.ts'));
  const bad = await draw(write('chat-bad.json', [{title: 'B', figure: 'chat-bad.diagram.ts'}]));
  assert.equal(bad.slides[0], null);
  assert.ok(bad.errors.some(e => e.startsWith('slides[0].figure: ') && e.includes('chat-self-missing')), JSON.stringify(bad.errors));
  const ok = await draw(write('chat-ok.json', [{title: 'O', figure: 'chat-ok.diagram.ts'}]));
  assert.deepEqual(ok.errors, []);
  assert.ok(ok.slides[0]);
});
