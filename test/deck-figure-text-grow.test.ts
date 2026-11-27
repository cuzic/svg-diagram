// ADR 0085 D2 (U2): in a deck, concentric / venn / cycle draw their labels larger (about 21 px on the slide, never under the usual 14 px) when
// the figure, scaled onto the slide, would come out smaller. Invented wording throughout. Document figures are unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {renderDeckSpec} from '../lib/deck-render-spec.ts';
import {renderDeckFigure} from '../lib/deck-render-figure.ts';
import {renderSpec} from '../lib/spec-render.ts';
import {renderDeckPptxEdge as renderFullEdge} from '../lib/pptx-deck-edge.ts';
import {renderDeckPptxEdge as renderSelectiveEdge} from '../lib/pptx-deck-selective-edge.ts';
import {askedTextSize, growFigure, growsText, TARGET_EFFECTIVE_PX} from '../lib/deck-grow.ts';
import {askTextSize, concentricFits, cycleFits, growBand, growParts, growSizes, vennFits} from '../lib/flow-grow.ts';
import {band, defOf} from '../lib/band-def.ts';
import {vennPart} from '../lib/spec-parts/selective/venn.ts';
import {cyclePart} from '../lib/spec-parts/selective/cycle.ts';
import {concentricPart} from '../lib/spec-parts/selective/concentric.ts';
import {flowPptx} from '../lib/pptx/flow-band.ts';
import {closeMeasurer} from '../lib/dsl.ts';
import {ROLES} from '../lib/tokens.ts';
import type {LaidOutFlowShape, VennBand, CycleBand, CycleOpts, ConcentricBand} from '../lib/flow-types.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-text-grow-'));
test.after(async () => { fs.rmSync(tmp, {recursive: true, force: true}); await closeMeasurer(); });

const named = (...names: string[]) => names.map(label => ({label}));
const parts: Record<string, object> = {
  concentric3: {type: 'concentric', order: 'inner-first', labels: 'inside', centre: '利用者', rings: named('チーム', '顧客と取引先', '社会')},
  concentric5: {type: 'concentric', order: 'inner-first', labels: 'inside', centre: '利用者', rings: named('チーム', '部門', '顧客と取引先', '業界', '社会')},
  venn3: {type: 'venn', sets: [{name: '調達'}, {name: '製造'}, {name: '販売'}], overlaps: [{sets: ['調達', '製造'], label: '品質'}, {sets: ['製造', '販売'], label: '納期'}, {sets: ['調達', '販売'], label: '価格'}], universe: '会社'},
  cycle4: {type: 'cycle', steps: named('計画', '実行', '確認', '改善'), centre: '継続'},
  cycle6: {type: 'cycle', steps: named('計画を立てる', '実行する', '結果を確認', '改善を決める', '全体へ共有', '定着させる'), centre: '継続'},
};
const figure = (part: object) => ({version: 1, title: 'f', showTitle: false, parts: [part]});
const lead = {lead: '本文のリード文です。'};
const callout = {lead: '本文のリード文です。', callouts: [{label: '要点', text: '各段階の終わりに確認を入れる。'}]};

/** The figure on the slide: its layout size, the scale it is drawn at, and its sizes (px in the figure) read from the outlined glyphs. */
function figureOf(svg: string): {k: number; sizes: number[]; warnings?: string[]} {
  const m = /<svg viewBox="0 0 ([\d.]+) ([\d.]+)" x="[\d.]+" y="[\d.]+" width="([\d.]+)"/.exec(svg);
  assert.ok(m, 'a nested figure');
  const start = svg.indexOf(m[0]), inner = svg.slice(start, svg.indexOf('</svg>', start));
  return {k: Number(m[3]) / Number(m[1]), sizes: [...inner.matchAll(/scale\(([\d.]+) -/g)].map(x => Math.round(Number(x[1]) * 10000) / 10)};
}

async function onSlide(name: string, extra: object): Promise<{k: number; size: number; effective: number; warnings: string[]; errors: string[]}> {
  const file = path.join(tmp, `${name}-${Object.keys(extra).join('-')}.json`);
  fs.writeFileSync(file, JSON.stringify({slides: [{title: '見出し', ...extra, figure: figure(parts[name]!)}]}));
  const r = loadDeck(file);
  assert.ok(r.ok);
  const out = await renderDeck(r.loaded, cfg);
  const f = figureOf(out.slides[0]?.svg ?? '');
  const size = Math.min(...f.sizes);
  return {k: f.k, size, effective: size * f.k, warnings: out.warnings, errors: out.errors};
}

// ---- before / after on the ADR's measured cases (before: ADR 0085 "測ったこと", every label 14 px) ----
const CASES: [name: string, extra: object, before: number][] = [
  ['concentric3', lead, 15.6], ['venn3', lead, 13.4], ['cycle4', lead, 13.8], ['cycle6', lead, 13.8],
  ['concentric3', callout, 14.1], ['venn3', callout, 12.2], ['cycle4', callout, 12.5], ['cycle6', callout, 12.5],
];

test('renderDeck: the labels come out about 21 px on the slide (before: 12.2-15.6 px), with no 14 px warning', async () => {
  for (const [name, extra, before] of CASES) {
    const r = await onSlide(name, extra);
    assert.deepEqual(r.errors, [], name);
    assert.ok(r.size > 14, `${name}: drawn at ${r.size}px in the figure`);
    assert.ok(r.effective >= before + 3 && r.effective >= 19 && r.effective <= TARGET_EFFECTIVE_PX + 1.5, `${name}/${Object.keys(extra).length}: ${before} -> ${r.effective.toFixed(1)}px`);
    assert.deepEqual(r.warnings, [], `${name}: no new warning where the larger size fits`);
  }
});

test('renderDeck: a figure that does not fit larger labels stays at 14 px (five thin rings), and is still not under 14 px on the slide', async () => {
  const r = await onSlide('concentric5', lead);
  assert.equal(r.size, 14);
  assert.ok(r.effective >= 14, `${r.effective}`);
  assert.deepEqual(r.warnings, []);
});

test('renderDeck: a figure already at 21 px (k 1.5) is left as it is: floor(21 / 1.5) is 14', async () => {
  // a narrow column draws a venn at the cap
  const file = path.join(tmp, 'cols.json');
  fs.writeFileSync(file, JSON.stringify({slides: [{title: '見出し', columns: [{figure: figure(parts['venn3']!), width: 2}, {text: '本文', width: 1}]}]}));
  const r = loadDeck(file);
  assert.ok(r.ok);
  const out = await renderDeck(r.loaded, cfg);
  const f = figureOf(out.slides[0]?.svg ?? '');
  assert.ok(Math.abs(f.k - 1.5) < 0.01 && Math.min(...f.sizes) === 14, JSON.stringify(f));
});

test('renderDeck: a column figure is drawn larger too (fixed columns and auto columns)', async () => {
  for (const [name, columns] of [['fixed', [{figure: figure(parts['concentric3']!), width: 2}, {text: '本文'}]], ['auto', [{figure: figure(parts['concentric3']!)}, {text: '本文'}]]] as const) {
    const file = path.join(tmp, `col-${name}.json`);
    fs.writeFileSync(file, JSON.stringify({slides: [{title: '見出し', columns}]}));
    const r = loadDeck(file);
    assert.ok(r.ok);
    const out = await renderDeck(r.loaded, cfg);
    assert.deepEqual(out.errors, [], name);
    const f = figureOf(out.slides[0]?.svg ?? '');
    assert.ok(Math.min(...f.sizes) > 14 && Math.min(...f.sizes) * f.k >= 19, `${name}: ${JSON.stringify(f)}`);
    assert.deepEqual(out.warnings, [], name);
  }
});

test('renderDeck: fit width and the .ts figure (no spec) are handled: width grows the same way, a source figure is left alone', async () => {
  const file = path.join(tmp, 'fitwidth.json');
  fs.writeFileSync(file, JSON.stringify({fit: 'width', slides: [{title: '見出し', ...lead, figure: figure(parts['venn3']!)}]}));
  const r = loadDeck(file);
  assert.ok(r.ok);
  const f = figureOf((await renderDeck(r.loaded, cfg)).slides[0]?.svg ?? '');
  assert.ok(Math.min(...f.sizes) > 14 && Math.min(...f.sizes) * f.k >= 17, JSON.stringify(f));
  assert.equal(growsText('fig.diagram.ts'), false);
  assert.equal(growsText(figure(parts['versus'] ?? {type: 'versus'})), false);
});

// ---- the document figure is unchanged ----
test('a document figure is byte-identical: no size is asked, no candidate is measured', async () => {
  for (const name of ['concentric3', 'venn3', 'cycle6']) {
    const doc = await renderSpec(figure(parts[name]!), {config: cfg});
    const sizes = new Set([...(doc as {svg: string}).svg.matchAll(/font-size="([\d.]+)"/g)].map(m => m[1]));
    assert.ok(sizes.size > 0 && [...sizes].every(x => x === '14' || x === '15' || x === '16'), `${name}: ${[...sizes]}`);
  }
  const deckSvg = (await renderDeckSpec(figure(parts['venn3']!), cfg))?.svg;
  const asked = (await renderDeckSpec(figure(parts['venn3']!), cfg, undefined, undefined))?.svg;
  assert.equal(asked, deckSvg, 'no textSize: the same drawing');
  assert.deepEqual(growSizes(undefined, 14), []);
  assert.deepEqual(growSizes(14, 14), []);
  assert.deepEqual(growSizes(21, 14), [21, 19, 17, 15]);
  assert.deepEqual(growSizes(30, 14), [22, 20, 18, 16], 'the part never draws past 22px');
  const bands = [{type: 'venn'}, {type: 'table'}];
  askTextSize(bands, undefined);
  assert.deepEqual(bands, [{type: 'venn'}, {type: 'table'}]);
  // a band without a definition of its own takes the built-in one the caller names
  askTextSize(bands, 18, () => ({type: 'venn', layout: () => ({h: 1, laid: {}})}));
  assert.deepEqual(bands.map(b => (b as {textSize?: number}).textSize), [18, undefined]);
});

// ---- the second layout pass ----
test('askedTextSize: floor(21 / k), and nothing when 14 px already comes out at 21 px', () => {
  assert.equal(askedTextSize(1.5), undefined);
  assert.equal(askedTextSize(1.2), 17);
  assert.equal(askedTextSize(1), 21);
  assert.equal(askedTextSize(0.868), 24);
});

test('growFigure: a second drawing that makes the figure scale down more is not taken; neither is a failed one', async () => {
  const spec = figure(parts['venn3']!), room = {w: 1168, h: 500};
  const first = {w: 940, h: 560, tag: 'first'};
  const taller = await growFigure(spec, first, room, 1.5, async () => ({w: 940, h: 600, tag: 'taller'}));
  assert.equal(taller.tag, 'first');
  const failed = await growFigure(spec, first, room, 1.5, async () => null);
  assert.equal(failed.tag, 'first');
  let asked = 0;
  const same = await growFigure(spec, first, room, 1.5, async size => { asked = size; return {w: 940, h: 560, tag: 'again'}; });
  assert.equal(same.tag, 'again');
  assert.equal(asked, Math.floor(21 / (500 / 560)));
  const flat = await growFigure(spec, {w: 700, h: 100, tag: 'flat'}, room, 1.5, async () => { throw new Error('not asked: 14px already comes out at 21px'); });
  assert.equal(flat.tag, 'flat');
  assert.equal((await growFigure(figure({type: 'table'}), first, room, 1.5, async () => { throw new Error('not a part that grows'); })).tag, 'first');
  assert.equal((await growFigure(spec, first, null, 1.5, async () => { throw new Error('no room'); })).tag, 'first');
});

// ---- the fit tests, on a laid-out shape ----
const flowShape = (primitives: object[], boxes: {label: string; x: number; y: number; w: number; h: number}[]): LaidOutFlowShape => ({type: 'venn', x: 0, y: 0, w: 940, h: 500, primitives, texts: [], anchors: [], labelBoxes: boxes}) as unknown as LaidOutFlowShape;
const circle = (cx: number, cy: number, r: number) => ({k: 'circle', cx, cy, r});

test('vennFits: a set title in the part only it covers, an overlap label in the part its sets share', () => {
  const b = {type: 'venn', sets: [{name: 'a'}, {name: 'b'}], overlaps: [{sets: ['a', 'b'], label: 'ab'}]} as unknown as VennBand;
  const circles = [circle(300, 250, 150), circle(500, 250, 150)];
  const ok = flowShape(circles, [{label: 'a', x: 190, y: 240, w: 40, h: 20}, {label: 'ab', x: 380, y: 240, w: 40, h: 20}, {label: 'b', x: 570, y: 240, w: 40, h: 20}]);
  assert.equal(vennFits(b, ok), true);
  // the title of a reaches into the part shared with b
  assert.equal(vennFits(b, flowShape(circles, [{label: 'a', x: 300, y: 240, w: 80, h: 20}])), false);
  // the overlap label sticks out of the shared part
  assert.equal(vennFits(b, flowShape(circles, [{label: 'ab', x: 330, y: 240, w: 140, h: 20}])), false);
  // the 0.92 margin: a title 1 px inside the circle does not fit
  assert.equal(vennFits(b, flowShape(circles, [{label: 'a', x: 151, y: 240, w: 60, h: 20}])), false);
});

test('concentricFits: each ring label inside its own band; not for sectors or labels at the side', () => {
  const b = {type: 'concentric', order: 'outer-first', labels: 'inside', rings: [{label: 'outer'}, {label: 'inner'}]} as unknown as ConcentricBand;
  const rings = [circle(470, 250, 200), circle(470, 250, 100)];
  assert.equal(concentricFits(b, flowShape(rings, [{label: 'outer', x: 440, y: 80, w: 60, h: 20}, {label: 'inner', x: 440, y: 165, w: 60, h: 20}])), true);
  assert.equal(concentricFits(b, flowShape(rings, [{label: 'outer', x: 440, y: 130, w: 60, h: 40}])), false, 'the outer label reaches into the inner ring');
  assert.equal(concentricFits(b, flowShape(rings, [{label: 'outer', x: 160, y: 80, w: 100, h: 20}])), false, 'a corner outside the outer ring');
  assert.equal(concentricFits({...b, labels: 'side'}, flowShape(rings, [])), false);
  assert.equal(concentricFits({...b, sectors: []} as unknown as ConcentricBand, flowShape(rings, [])), false);
});

test('cycleFits: each step label inside its circle; not for a cycle with links', () => {
  const b = {type: 'cycle', steps: [{label: 'a'}, {label: 'b'}], centre: 'mid'} as unknown as CycleBand;
  const nodes = [circle(200, 100, 50), circle(400, 100, 50)];
  assert.equal(cycleFits(b, flowShape(nodes, [{label: 'a', x: 180, y: 90, w: 40, h: 20}, {label: 'b', x: 380, y: 90, w: 40, h: 20}, {label: 'mid', x: 280, y: 90, w: 40, h: 20}])), true);
  assert.equal(cycleFits(b, flowShape(nodes, [{label: 'a', x: 150, y: 90, w: 100, h: 20}])), false, 'wider than its circle');
  assert.equal(cycleFits(b, flowShape(nodes, [{label: 'mid', x: 230, y: 90, w: 60, h: 20}])), false, 'the centre label runs into a circle');
  assert.equal(cycleFits({...b, links: 'all' as never}, flowShape(nodes, [])), false);
});

// ---- the entry points: the same deck through renderDeck and the edge writers (ADR 0056 D2) ----
const rasterize = () => new Uint8Array([0]);
const szOf = (pptx: Uint8Array | null): number[] => [...unzipEntry(Buffer.from(pptx as Uint8Array), 'ppt/slides/slide1.xml').toString().matchAll(/<a:rPr\b[^>]*?\bsz="(\d+)"/g)].map(m => Number(m[1]) / 100);

test('parity: renderDeck and both edge writers (full catalog, selected parts) draw the same label size', async () => {
  const selected = {parts: [vennPart, cyclePart, concentricPart], bands: {venn: flowPptx, cycle: flowPptx, concentric: flowPptx}, rasterize};
  for (const name of ['concentric3', 'venn3', 'cycle6']) {
    const slide = {title: '見出し', ...callout, figure: figure(parts[name]!)};
    const shown = await onSlide(name, callout);
    const pt = shown.effective * 0.75;
    for (const [what, edge] of [['full', renderFullEdge], ['selected', renderSelectiveEdge]] as const) {
      const r = await (edge as typeof renderSelectiveEdge)({slides: [slide]}, realEngine(), selected as never);
      assert.deepEqual(r.issues, [], `${name}/${what}`);
      assert.deepEqual(r.warnings, [], `${name}/${what}`);
      const sizes = szOf(r.pptx);
      assert.ok(sizes.some(s => Math.abs(s - pt) < 0.6), `${name}/${what}: renderDeck ${pt.toFixed(2)}pt, edge ${JSON.stringify([...new Set(sizes)])}`);
    }
  }
});

test('a size that makes the figure taller is not taken (a long katakana word grows the circles with the text)', async () => {
  const kana = figure({type: 'cycle', steps: named('マーケティング施策', 'コンテンツ制作', 'パフォーマンス測定', 'ステークホルダー調整'), centre: '継続'});
  const base = await renderDeckSpec(kana, cfg);
  const asked = await renderDeckSpec(kana, cfg, undefined, 22);
  assert.ok(base && asked);
  assert.ok(asked.laidOut.canvasHeight <= base.laidOut.canvasHeight + 0.5, `${asked.laidOut.canvasHeight} > ${base.laidOut.canvasHeight}`);
  const sizes = (r: typeof base) => [...new Set(r.laidOut.laidOut.flatMap(b => 'texts' in b ? (b.texts as {size: number}[]).map(t => t.size) : []))];
  assert.deepEqual(sizes(asked), sizes(base), 'drawn at the usual size');
});

// a band whose definition draws a venn of two circles with a label as wide as the label size makes it, so a size fits up to a point
function fakeVenn(wideAbove: number) {
  const drawn: number[] = [], measured: number[] = [];
  const def = {
    type: 'venn',
    measure: (_d: unknown, env: {roles: {note: number}}) => { measured.push(env.roles.note); },
    layout: (_d: unknown, env: {roles: {note: number}}) => {
      drawn.push(env.roles.note);
      const w = env.roles.note > wideAbove ? 400 : 20;
      return {h: 100, laid: flowShape([circle(300, 250, 150), circle(500, 250, 150)], [{label: 'a', x: 300 - w / 2 - 60, y: 240, w, h: 20}])};
    },
  };
  const data = {type: 'venn', sets: [{name: 'a'}, {name: 'b'}], overlaps: []};
  return {drawn, measured, banded: band(def as never, data as never)};
}

test('growBand: measures every candidate size and draws the largest at which the labels fit; else the usual size', () => {
  const env = (note = 14) => ({roles: {...ROLES, note}}) as never;
  const run = (wideAbove: number, size?: number) => {
    const {drawn, measured, banded} = fakeVenn(wideAbove);
    const out = size === undefined ? banded : growBand(banded, size);
    const def = defOf(out) as unknown as {measure(d: unknown, e: unknown): void; layout(d: unknown, e: unknown): {h: number}};
    def.measure(out, env());
    const placed = def.layout(out, env());
    return {drawn, measured, placed};
  };
  const plain = run(99);
  assert.deepEqual([plain.measured, plain.drawn], [[14], [14]], 'nothing asked: one size, drawn once');
  const grown = run(18, 20);
  assert.deepEqual(grown.measured, [14, 20, 18, 16], 'every candidate is measured');
  assert.deepEqual(grown.drawn, [14, 20, 18], 'the largest first, down to the first that fits (18)');
  assert.deepEqual(run(10, 20).drawn, [14, 20, 18, 16], 'none fits: the usual drawing is kept');
  assert.equal(growBand({type: 'table'}, 20).type, 'table');
  assert.deepEqual(growBand({type: 'table'}, 20), {type: 'table'}, 'a band of another part is left alone');
});

test('growParts: only the parts that can use larger labels build bands asking for them', () => {
  const venn = {type: 'venn', build: () => band({type: 'venn', layout: () => ({h: 1, laid: {}})} as never, {type: 'venn'} as never)};
  const table = {type: 'table', build: () => ({type: 'table'})};
  const [v, t] = growParts([venn, table] as never, 18);
  assert.equal((v as unknown as {build(p: unknown, at: string): {textSize?: number}}).build({}, '').textSize, 18);
  assert.equal(t, table);
});

test('the fallback drawing (a canvas figure leaves the selected-parts path) is asked for the larger labels too', async () => {
  const canvasSpec = {version: 1, title: 'f', showTitle: false, canvas: {minText: 14}, parts: [parts['concentric3']!]};
  const sizes = async (textSize?: number) => {
    const r = await renderDeckFigure(0, canvasSpec, undefined, cfg, {textSize});
    assert.ok(r.ok);
    return [...new Set(r.result.laidOut.laidOut.flatMap(b => 'texts' in b ? (b.texts as {size: number}[]).map(t => t.size) : []))];
  };
  assert.deepEqual(await sizes(), [14]);
  assert.deepEqual(await sizes(22), [22]);
});

test('the centre label: inside the innermost ring (concentric), in the part all the sets share (venn), clear of the step circles (cycle)', () => {
  const rings = {type: 'concentric', order: 'outer-first', labels: 'inside', centre: 'mid', rings: [{label: 'outer'}, {label: 'inner'}]} as unknown as ConcentricBand;
  const ringCircles = [circle(470, 250, 200), circle(470, 250, 100)];
  assert.equal(concentricFits(rings, flowShape(ringCircles, [{label: 'mid', x: 440, y: 240, w: 60, h: 20}])), true);
  assert.equal(concentricFits(rings, flowShape(ringCircles, [{label: 'mid', x: 440, y: 120, w: 60, h: 20}])), false, 'the centre label is out of the innermost ring');
  const v = {type: 'venn', sets: [{name: 'a'}, {name: 'b'}], overlaps: [], centre: 'both'} as unknown as VennBand;
  const sets = [circle(300, 250, 150), circle(500, 250, 150)];
  assert.equal(vennFits(v, flowShape(sets, [{label: 'both', x: 380, y: 240, w: 40, h: 20}])), true);
  assert.equal(vennFits(v, flowShape(sets, [{label: 'both', x: 200, y: 240, w: 40, h: 20}])), false, 'the centre label is outside the shared part');
  // a framed cycle keeps the usual size by the height guard, so nothing here (see the README)
});

test('textSize is not a public option of the DSL parts', () => {
  // @ts-expect-error textSize is the deck's own request (ADR 0085), not an option of cycle()
  const _bad: CycleOpts = {textSize: 22};
  void _bad;
});
