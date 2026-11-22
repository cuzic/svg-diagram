// node spikes/comic-worksheet/run.ts [outdir]  — measures with the font files (HarfBuzz), as the Node entry does.
import fs from 'node:fs';
import {measureWithFonts} from '../../lib/font-metrics.ts';
import {COLOR, contrast, layoutComic, type Values} from './proto.ts';
import {sample} from './sample.ts';

const hb = (text: string, size: number, weight = 400) => measureWithFonts(new Map([['k', {text, size, weight, font: 'sans' as const}]])).get('k')!.w;
const out = process.argv[2];
let t = performance.now();
const laid = layoutComic(sample, hb);
const tLayout = performance.now() - t;
const empty: Values = {};
const filled: Values = {day: '水曜', what: '引継ぎ', prep: '資料を共有', change: '早く帰る', wish: '週に一度は早く帰る'};
const skipped: Values = {day: null, what: '引継ぎ', prep: undefined, change: null, wish: '素敵'};
const long: Values = {...filled, change: 'とてもとてもながいへんか'};
const strip = (s: string) => s.replace(/<g data-slot="[^"]*">.*?<\/g>/g, '<slot/>').replace(/<title>.*?<\/title>/g, '');
const states = [empty, filled, skipped, long].map(v => laid.svg(v));
const sameShape = states.every(s => strip(s) === strip(states[0]!));
// a +-0.0156px engine difference on every measured width must change nothing
const nudge = (d: number) => layoutComic(sample, (x, s, w) => hb(x, s, w) + d);
const same = (a: ReturnType<typeof layoutComic>, b: ReturnType<typeof layoutComic>) => JSON.stringify(a.geometry) === JSON.stringify(b.geometry) && a.svg(filled) === b.svg(filled);
const stable = same(laid, nudge(0.0156)) && same(laid, nudge(-0.0156));
// the cost of update: first value measured, then a second value; a repeat costs nothing
const s0 = laid.stats.valueMeasures; t = performance.now(); laid.svg({...filled, change: 'のんびりしている'}); const tOne = performance.now() - t; const s1 = laid.stats.valueMeasures;
t = performance.now(); laid.svg({...filled, change: 'のんびりしている'}); const tRepeat = performance.now() - t;
console.log(JSON.stringify({
  layoutMs: +tLayout.toFixed(1), updateOneNewValueMs: +tOne.toFixed(2), updateRepeatMs: +tRepeat.toFixed(2), newMeasuresForOneValue: s1 - s0, size: [laid.width, laid.height],
  geometryBytes: JSON.stringify(laid.geometry).length, geometryEntries: Object.values(laid.geometry).reduce((n, o) => n + Object.keys(o).length, 0),
  sameShapeAcrossFourStates: sameShape, stableUnderEngineNoise: stable,
  contrast: {prompt: +contrast(COLOR.prompt, '#ffffff').toFixed(2), filled: +contrast(COLOR.filled, '#ffffff').toFixed(2)},
  overflow: laid.valueFindings(long), findings: laid.findings,
  wrapped: Object.fromEntries(Object.entries(laid.wrapped).map(([k, w]) => [k, `${w.lines.join(' | ')} (inner ${w.inner}${w.notes.length ? ', ' + w.notes.join('+') : ''})`])),
  bubbles: Object.fromEntries(Object.entries(laid.geometry.bubbles).map(([k, r]) => [k, `${r.x},${r.y} ${r.w}x${r.h}`])),
}, null, 1));
if (out) { fs.mkdirSync(out, {recursive: true}); fs.writeFileSync(`${out}/empty.svg`, states[0]!); fs.writeFileSync(`${out}/filled.svg`, states[1]!); fs.writeFileSync(`${out}/geometry.json`, JSON.stringify(laid.geometry)); }

// the checks fire on a deliberately bad worksheet
const badWs = {panels: [{id: 'x1', chars: [{id: 'a', side: 'left' as const, face: 'smile' as const, hue: 1}, {id: 'b', side: 'left' as const, face: 'smile' as const, hue: 2}],
  lines: [{speaker: 'zz', kind: 'say' as const, tpl: '{one}と{two}と{three}', slots: {one: {max: 12, prompt: 'あ'}, two: {max: 2, prompt: 'いろはにほ'}}}]}]};
console.log('bad:', layoutComic(badWs, hb).findings.map(f => f.rule).join(' '));
