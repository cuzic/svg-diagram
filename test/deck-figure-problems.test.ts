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
  assert.match(e!, /the deck is not written until the figure is fixed/);
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
