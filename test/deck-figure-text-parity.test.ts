// ADR 0085 D2 + ADR 0056 D2: the same deck gives the same label sizes and the same warnings through serve (renderDeck), both edge writers
// (full catalog, selected parts) and the pptx-deck CLI, in every fit mode and figure layout: a figure alone, with its own width, in fixed
// columns, in auto columns, in two figure columns. Invented wording.
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
import {renderDeckPptxEdge as renderFullEdge} from '../lib/pptx-deck-edge.ts';
import {renderDeckPptxEdge as renderSelectiveEdge} from '../lib/pptx-deck-selective-edge.ts';
import {renderDeckPptxEdgeWith} from '../lib/pptx-deck-edge-core.ts';
import {planFigureEdge} from '../lib/pptx-edge.ts';
import {validateDeck} from '../lib/deck-spec.ts';
import {vennPart} from '../lib/spec-parts/selective/venn.ts';
import {cyclePart} from '../lib/spec-parts/selective/cycle.ts';
import {concentricPart} from '../lib/spec-parts/selective/concentric.ts';
import {flowPptx} from '../lib/pptx/flow-band.ts';
import {closeMeasurer} from '../lib/dsl.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-text-parity-'));
test.after(async () => { fs.rmSync(tmp, {recursive: true, force: true}); await closeMeasurer(); });

const named = (...names: string[]) => names.map(label => ({label}));
const PARTS: Record<string, object> = {
  concentric3: {type: 'concentric', order: 'inner-first', labels: 'inside', centre: '利用者', rings: named('チーム', '顧客と取引先', '社会')},
  rings5: {type: 'concentric', order: 'inner-first', labels: 'inside', centre: '利用者', rings: named('チーム', '部門', '顧客と取引先', '業界', '社会')},
  venn3: {type: 'venn', sets: [{name: '調達'}, {name: '製造'}, {name: '販売'}], overlaps: [{sets: ['調達', '製造'], label: '品質'}, {sets: ['製造', '販売'], label: '納期'}], universe: '会社'},
  cycle6: {type: 'cycle', steps: named('計画を立てる', '実行する', '結果を確認', '改善を決める', '全体へ共有', '定着させる'), centre: '継続'},
};
const fig = (name: string, width?: number) => ({version: 1, title: 'f', showTitle: false, ...(width ? {width} : {}), parts: [PARTS[name]!]});
const LAYOUTS: ((name: string, i: number) => object)[] = [
  (n, i) => ({figure: fig(n), ...text(i)}),
  (n, i) => ({figure: fig(n, 900), ...text(i)}),
  (n) => ({columns: [{figure: fig(n), width: 2}, {text: '本文', width: 1}]}),
  (n) => ({columns: [{figure: fig(n)}, {text: '本文'}]}),
  (n) => ({columns: [{figure: fig(n), width: 1}, {figure: fig('concentric3'), width: 1}]}),
  (n, i) => ({columns: [{figure: fig(n, 500)}, {text: '本文'}], ...text(i)}),
];
const text = (i: number): object => i % 2 ? {lead: '本文のリード文です。', callouts: [{label: '要点', text: '各段階の終わりに確認を入れる。'}]} : {lead: '本文のリード文です。'};
const decks = (['fill', 'width'] as const).flatMap(fit => [0, 1].map(half => {
  const slides = LAYOUTS.flatMap((layout, l) => Object.keys(PARTS).filter((_n, p) => (p + l) % 2 === half).map((n, p) => ({title: '見出し', ...layout(n, l + p)})));
  return {name: `${fit}-${half}`, deck: {fit, slides}};
}));

const rasterize = () => new Uint8Array([0]);
const szOf = (pptx: Uint8Array | null, n: number): number[] => [...unzipEntry(Buffer.from(pptx as Uint8Array), `ppt/slides/slide${n}.xml`).toString().matchAll(/<a:rPr\b[^>]*?\bsz="(\d+)"/g)].map(m => Number(m[1])).sort((a, b) => a - b);
const lines = (xs: {path: string; message: string}[]) => xs.map(x => `${x.path}: ${x.message}`).sort();

test('parity fuzz: renderDeck, both edge writers and the pptx-deck CLI agree on the label sizes and the warnings', async () => {
  const selected = {parts: [vennPart, cyclePart, concentricPart], bands: {venn: flowPptx, cycle: flowPptx, concentric: flowPptx}, rasterize};
  let grown = 0, refused = 0, warned = 0;
  for (const {name, deck} of decks) {
    const file = path.join(tmp, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(deck));
    const loaded = loadDeck(file);
    assert.ok(loaded.ok, name);
    const shown = await renderDeck(loaded.loaded, cfg);
    assert.deepEqual(shown.errors, [], name);
    const full = await renderFullEdge(deck, realEngine(), {rasterize});
    const sel = await renderSelectiveEdge(deck, realEngine(), selected as never);
    assert.deepEqual([full.issues, sel.issues], [[], []], name);
    const cli = spawnSync(process.execPath, [path.join(ROOT, 'pptx-deck-diagram.ts'), file, '--out', path.join(tmp, `${name}.pptx`)], {encoding: 'utf8', cwd: ROOT});
    assert.equal(cli.status, 0, cli.stderr);
    const cliPptx = new Uint8Array(fs.readFileSync(path.join(tmp, `${name}.pptx`)));
    const cliWarnings = cli.stderr.split('\n').filter(l => l.startsWith('⚠ ')).map(l => l.slice(2)).sort();
    assert.deepEqual(lines(full.warnings), lines(sel.warnings), `${name}: full vs selected warnings`);
    assert.deepEqual(cliWarnings, lines(full.warnings), `${name}: CLI vs edge warnings`);
    assert.deepEqual([...shown.warnings].sort(), lines(full.warnings), `${name}: serve vs edge warnings`);
    for (let n = 1; n <= deck.slides.length; n++) {
      const edge = szOf(full.pptx, n);
      assert.deepEqual(szOf(sel.pptx, n), edge, `${name} slide ${n}: selected edge`);
      assert.deepEqual(szOf(cliPptx, n), edge, `${name} slide ${n}: CLI`);
      // serve: the smallest text of the figure(s) on the slide, as the outlined glyphs give it, is one of the sizes the .pptx carries
      const svg = shown.slides[n - 1]?.svg ?? '';
      const figures = [...svg.matchAll(/<svg viewBox="0 0 ([\d.]+) [\d.]+" x="[\d.]+" y="[\d.]+" width="([\d.]+)"[^>]*>([\s\S]*?)<\/svg>/g)];
      for (const [, w, shownW, inner] of figures) {
        const k = Number(shownW) / Number(w);
        const sizes = [...(inner ?? '').matchAll(/scale\(([\d.]+) -/g)].map(m => Number(m[1]) * 1000 * k * 0.75 * 100);
        if (!sizes.length) continue;
        const smallest = Math.min(...sizes);
        assert.ok(edge.some(s => Math.abs(s - smallest) <= 25), `${name} slide ${n}: serve ${smallest.toFixed(0)} vs .pptx ${[...new Set(edge)]}`);
        if (smallest > 1500) grown++; else refused++;
      }
    }
    warned += full.warnings.length;
  }
  // the fuzz is only worth something if it reaches growth, refusal and warnings
  assert.ok(grown >= 8 && refused >= 4, `grown ${grown}, kept at the usual size ${refused}`);
  assert.ok(warned >= 1, 'some slide warns');
});

test('the edge writer does not take a larger drawing that raises a rule the first one did not', async () => {
  const slide = {title: '見出し', lead: '本文のリード文です。', figure: fig('venn3')};
  const real = (extra: string[]) => ({validate: (i: unknown) => validateDeck(i), plan: async (spec: unknown, engine: Parameters<typeof planFigureEdge>[1], width?: number, textSize?: number) => {
    const f = await planFigureEdge(spec, engine, {}, width, textSize);
    return 'issues' in f || textSize === undefined ? f : {...f, findings: [...f.findings, ...extra]};
  }});
  const sizes = async (extra: string[]) => szOf((await renderDeckPptxEdgeWith({slides: [slide]}, realEngine(), {rasterize}, real(extra))).pptx, 1);
  const grown = await sizes([]), refused = await sizes(['[brand-new-rule] x']);
  assert.ok(!grown.includes(Math.min(...refused)) && Math.min(...grown) > Math.min(...refused), `${grown} vs ${refused}`);
});
