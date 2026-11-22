// node spikes/comic-worksheet/run.ts [outdir]  — measures with the font files (HarfBuzz), as the Node entry does.
import fs from 'node:fs';
import {measureWithFonts} from '../../lib/font-metrics.ts';
import {layoutComic, type Values} from './proto.ts';
import {sample} from './sample.ts';

const widths = (text: string, size: number, weight = 400) => measureWithFonts(new Map([['k', {text, size, weight, font: 'sans' as const}]])).get('k')!.w;
const out = process.argv[2];
let t = performance.now();
const laid = layoutComic(sample, widths);
const tLayout = performance.now() - t;
const empty: Values = {};
const filled: Values = {day: '水曜', what: '引き継ぎ', prep: '資料を共有', change: '早く帰る', wish: '週に一度は早く帰る'}; // the last is longer than max 8
const skipped: Values = {day: null, what: '引き継ぎ', prep: undefined, change: null, wish: '素敵'};
t = performance.now(); const sE = laid.svg(empty); const tFill = performance.now() - t;
const sF = laid.svg(filled), sS = laid.svg(skipped);
// geometry: layout is computed once; svg(values) cannot change it. What does change: only <text data-slot> children.
const strip = (s: string) => s.replace(/<g data-slot="[^"]*">.*?<\/g>/g, '<slot/>');
const sameShape = strip(sE) === strip(sF) && strip(sF) === strip(sS);
const gj = JSON.stringify(laid.geometry);
console.log(JSON.stringify({
  layoutMs: +tLayout.toFixed(1), fillMs: +tFill.toFixed(2), size: [laid.width, laid.height], svgBytes: {empty: sE.length, filled: sF.length},
  geometryBytes: gj.length, geometryEntries: Object.values(laid.geometry).reduce((n, o) => n + Object.keys(o).length, 0),
  sameShapeAcrossStates: sameShape, overflow: laid.valueFindings({...filled, change: 'とてもとてもながいへんか', wish: '週に一度は早く帰る'}), findings: laid.findings,
  bubbles: Object.fromEntries(Object.entries(laid.geometry.bubbles).map(([k, r]) => [k, `${r.w}x${r.h}`])),
}, null, 1));
if (out) { fs.mkdirSync(out, {recursive: true}); fs.writeFileSync(`${out}/empty.svg`, sE); fs.writeFileSync(`${out}/filled.svg`, sF); fs.writeFileSync(`${out}/geometry.json`, gj); }
