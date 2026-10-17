// ADR 0031 §0: the state that leaks out of a render, pinned before it is fixed. The tests marked `todo` fail on main today and are
// switched on by the stage that fixes them (stage 2: PPTX tones; stage 4: the measure settings).
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {box, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {layoutDiagram} from '../lib/layout-measured.ts';
import {emitPptx} from '../lib/pptx/emit.ts';
import {configureMeasure, measureAll} from '../lib/measure.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';
import type {ToneOverrides} from '../lib/tokens.ts';

test.after(() => closeMeasurer());

const TONES: ToneOverrides = {accent: {fill: '#b8cfe8', dark: {fill: '#2a4a70'}}};
const figure = (appearance?: 'light' | 'dark' | 'auto') => diagram({theme: 'blue', tones: TONES, ...(appearance ? {appearance} : {})}).add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b', tone: 'accent'}));
const render = (appearance?: 'light' | 'dark' | 'auto') => renderDiagram(figure(appearance), {name: 'd.svg', budget: 'cacheOnly'});

// (a) ADR 0031 background 1: emitPptx did not go through withTones, so a figure's tone override was drawn in the built-in colour (fixed in stage 2: planSlide resolves the ToneEnv).
test('PPTX draws a tone override (the slide XML holds the overridden fill)', async () => {
  const {laidOut} = await render();
  const xml = unzipEntry(emitPptx(laidOut, {rasterFonts: []}), 'ppt/slides/slide1.xml').toString();
  assert.match(xml, /B8CFE8/i);
});

// (b) a characterisation of what is true today, so that the ToneEnv change cannot move it: the dark pair of an override is
// drawn in the dark appearance, is the @media block's colour in 'auto', and is what the dark side of verify judges.
test('tones × appearance: the override and its dark pair reach the SVG, the auto block and verify', async () => {
  assert.match((await render('light')).svg, /fill="#b8cfe8"/);
  const body = (svg: string) => svg.replace(/ data-tone-colors="[^"]*"/, ''); // the attribute lists both colours by design
  const dark = body((await render('dark')).svg);
  assert.match(dark, /#2a4a70/);
  assert.doesNotMatch(dark, /#b8cfe8/);
  const auto = body((await render('auto')).svg);
  assert.match(auto, /#b8cfe8/);
  assert.match(auto, /@media[^{]*prefers-color-scheme: dark[\s\S]*#2a4a70/);
  const rules = (await checkDiagram(figure('auto'))).verdict.findings.map(f => f.rule).sort();
  assert.deepEqual(rules, (await checkDiagram(figure('auto'))).verdict.findings.map(f => f.rule).sort());
});

// (c) ADR 0031 background 2: configureMeasure wrote process-wide globals that a measurement read after its `await` (fixed in stage 4: measureAll takes the settings at its start). Two font families measure
// the same text at different widths, so a leak shows as a different wrapped height.
const DIR = '/home/cuzic/.local/share/fonts/';
const REGULAR = DIR + 'BIZ-UDGothicR.ttc', BOLD = DIR + 'BIZ-UDGothicB.ttc', ARIAL = DIR + 'arial.ttf', ARIAL_BOLD = DIR + 'arialbd.ttf';
const fontsOf = (n: 0 | 1) => ({sans: n ? {regular: `${REGULAR}#1`, bold: `${BOLD}#1`} : {regular: ARIAL, bold: ARIAL_BOLD}, mono: {regular: `${REGULAR}#0`, bold: `${BOLD}#0`}});
// one cold text (the measure memo is keyed by the settings, so a text measured before would hide the leak)
const req = (text: string) => new Map([['t', {text, size: 16}]]);
test('two measurements with different settings do not mix their widths', {skip: ![REGULAR, BOLD, ARIAL, ARIAL_BOLD].every(f => fs.existsSync(f))}, async () => {
  const text = 'Wide wide mmm WWW iii — ADR 0031 repro, a text nothing else measures';
  configureMeasure({measure: 'font', fonts: fontsOf(1)});
  const first = measureAll(req(text));
  await Promise.resolve();
  configureMeasure({measure: 'font', fonts: fontsOf(0)}); // the second project loads while the first still awaits its measurement
  const second = measureAll(req(text));
  const [a, b] = [(await first).get('t')!.w, (await second).get('t')!.w];
  configureMeasure({measure: 'font', fonts: fontsOf(1)});
  const alone1 = (await measureAll(req(text + ' ')))?.get('t')!.w;
  assert.ok(Math.abs(alone1 - a) < 8 && a !== b, `the first measurement must use its own fonts (first ${a}, second ${b}, alone ${alone1})`);
});

// (d) ADR 0031 §2 (stage 3): the wrap mode is a value of the layout, not module state, so two renders in flight at once each break
// their labels by their own diagram({wrap}).
const KATAKANA = '新しいアプリケーションとデータベースのモニタリング'; // at width 240: char 新しいアプリケーショ / ン…, phrase 新しい / アプリケーションと / …
const wrapped = (wrap: 'char' | 'phrase') => renderDiagram(diagram({theme: 'blue', wrap, width: 240}).add(box({id: 'k', title: KATAKANA})), {name: 'd.svg', budget: 'cacheOnly'});
const linesOf = (r: Awaited<ReturnType<typeof wrapped>>): string[] => (r.laidOut.laidOut[0] as {wrappedRuns: {lines: string[]}[]}).wrappedRuns.flatMap(run => run.lines);
test('two renders at once with different wrap modes each break by their own mode', async () => {
  const [char, phrase] = await Promise.all([wrapped('char'), wrapped('phrase')]);
  const [charAlone, phraseAlone] = [await wrapped('char'), await wrapped('phrase')];
  assert.deepEqual(linesOf(char), linesOf(charAlone));
  assert.deepEqual(linesOf(phrase), linesOf(phraseAlone));
  assert.notDeepEqual(linesOf(char), linesOf(phrase), 'the text must break differently in the two modes, or the test shows nothing');
});

// The same through layoutDiagram: a diagram carries the settings of the project it was loaded from (DiagramData.measure), so the
// process default changing under it — a second project loading while this one awaits its measurement — does not reach its layout.
test('a diagram measures with its own settings while the process default changes under it', {skip: ![REGULAR, BOLD, ARIAL, ARIAL_BOLD].every(f => fs.existsSync(f))}, async () => {
  const title = Array.from({length: 12}, () => 'Wide wide mmm WWW iii').join(' ') + ' — layoutDiagram repro';
  const settings = (n: 0 | 1) => ({backend: 'font' as const, explicit: true, fonts: fontsOf(n)});
  const heightOf = async (n: 0 | 1) => {
    const d = {...diagram({theme: 'blue', width: 360}).add(box({id: 'a', title})), measure: settings(n)};
    const b = (await layoutDiagram(d as never)).laidOut.find(x => x.type === 'box');
    return b && 'h' in b ? b.h : NaN;
  };
  configureMeasure({measure: 'font', fonts: fontsOf(1)});
  const alone1 = await heightOf(1), alone0 = await heightOf(0);
  assert.notEqual(alone0, alone1, 'the two settings must wrap differently, or this test says nothing');
  const first = heightOf(1);
  configureMeasure({measure: 'font', fonts: fontsOf(0)}); // a second project is loaded while the first is still being laid out
  const second = heightOf(0);
  assert.deepEqual([await first, await second], [alone1, alone0]);
});
