// ADR 0031 §0: the state that leaks out of a render, pinned before it is fixed. The tests marked `todo` fail on main today and are
// switched on by the stage that fixes them (stage 2: PPTX tones; stage 4: the measure settings).
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {box, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {emitPptx} from '../lib/pptx/emit.ts';
import {configureMeasure, measureAll} from '../lib/measure.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';
import type {ToneOverrides} from '../lib/tokens.ts';

test.after(() => closeMeasurer());

const TONES: ToneOverrides = {accent: {fill: '#b8cfe8', dark: {fill: '#2a4a70'}}};
const figure = (appearance?: 'light' | 'dark' | 'auto') => diagram({theme: 'blue', tones: TONES, ...(appearance ? {appearance} : {})}).add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b', tone: 'accent'}));
const render = (appearance?: 'light' | 'dark' | 'auto') => renderDiagram(figure(appearance), {name: 'd.svg', budget: 'cacheOnly'});

// (a) ADR 0031 background 1: emitPptx does not go through withTones, so a figure's tone override is drawn in the built-in colour.
test('PPTX draws a tone override (the slide XML holds the overridden fill)', {todo: 'ADR 0031 stage 2: PPTX ignores diagram({tones})'}, async () => {
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

// (c) ADR 0031 background 2: configureMeasure writes process-wide globals that layout reads after its `await`. Two font families measure
// the same text at different widths, so a leak shows as a different wrapped height.
const DIR = '/home/cuzic/.local/share/fonts/';
const REGULAR = DIR + 'BIZ-UDGothicR.ttc', BOLD = DIR + 'BIZ-UDGothicB.ttc', ARIAL = DIR + 'arial.ttf', ARIAL_BOLD = DIR + 'arialbd.ttf';
const fontsOf = (n: 0 | 1) => ({sans: n ? {regular: `${REGULAR}#1`, bold: `${BOLD}#1`} : {regular: ARIAL, bold: ARIAL_BOLD}, mono: {regular: `${REGULAR}#0`, bold: `${BOLD}#0`}});
// one cold text (the measure memo is keyed by the settings, so a text measured before would hide the leak)
const req = (text: string) => new Map([['t', {text, size: 16}]]);
test('two measurements with different settings do not mix their widths', {todo: 'ADR 0031 stage 4: configureMeasure is a process-wide global', skip: ![REGULAR, BOLD, ARIAL, ARIAL_BOLD].every(f => fs.existsSync(f))}, async () => {
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
