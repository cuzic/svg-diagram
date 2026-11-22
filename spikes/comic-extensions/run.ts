// node spikes/comic-extensions/run.ts [outdir] — manpu / props on the ADR 0074 prototype: collision check, nudging, determinism, size.
import fs from 'node:fs';
import {measureWithFonts} from '../../lib/font-metrics.ts';
import {layoutComic, type Values} from '../comic-worksheet/proto.ts';
import {sample} from '../comic-worksheet/sample.ts';
import {placeExtras, type ManpuKind, type PanelExtras, type PropKind} from './manpu.ts';

const hb = (text: string, size: number, weight = 400) => measureWithFonts(new Map([['k', {text, size, weight, font: 'sans' as const}]])).get('k')!.w;
const laid = layoutComic(sample, hb);
const panels = sample.panels.map(p => ({id: p.id, lineSpeakers: p.lines.map(l => l.speaker)}));
const sides = (id: string) => Object.fromEntries(sample.panels.find(p => p.id === id)!.chars.map(c => [c.id, c.side])) as Record<string, 'left' | 'center' | 'right'>;
// one scene: each panel gets symbols that match its faces, plus a few props
const scene: PanelExtras[] = [
  {panel: 'p1', side: sides('p1'), manpu: [{kind: 'sparkle', on: 'me'}], props: [{kind: 'documents', on: 'me', at: 'hand'}]},
  {panel: 'p2', side: sides('p2'), manpu: [{kind: 'exclaim', on: 'col'}, {kind: 'sweat', on: 'me'}], props: [{kind: 'coffee', on: 'col', at: 'hand'}]},
  {panel: 'p3', side: sides('p3'), manpu: [{kind: 'question', on: 'me'}, {kind: 'sweat', on: 'col'}], props: [{kind: 'pc', on: 'me', at: 'floor'}, {kind: 'clock', on: 'col', at: 'wall-out'}]},
  {panel: 'p4', side: sides('p4'), manpu: [{kind: 'heart', on: 'me'}, {kind: 'sparkle', on: 'col'}], props: [{kind: 'calendar', on: 'col', at: 'wall-out'}]},
];
const first = placeExtras(laid.geometry, panels, scene, {nudge: false});
const nudged = placeExtras(laid.geometry, panels, scene);
// sweep: every symbol x every character of every panel, first choice only vs. with candidates
const kinds: ManpuKind[] = ['sweat', 'anger', 'sparkle', 'question', 'exclaim', 'heart', 'sigh', 'idea', 'gloom', 'zzz'];
const sweep = (nudge: boolean) => { let n = 0, miss = 0; for (const p of sample.panels) for (const c of p.chars) for (const k of kinds) { const r = placeExtras(laid.geometry, panels, [{panel: p.id, side: sides(p.id), manpu: [{kind: k, on: c.id}]}], {nudge}); n++; miss += nudge ? r.findings.length : r.stats.firstChoiceHits; } return {n, miss}; };
const sw1 = sweep(false), sw2 = sweep(true);
const propKinds: PropKind[] = ['pc', 'coffee', 'calendar', 'clock', 'documents', 'phone'];
let propCases = 0, propMiss = 0;
for (const p of sample.panels) for (const c of p.chars) for (const k of propKinds) { const r = placeExtras(laid.geometry, panels, [{panel: p.id, side: sides(p.id), props: [{kind: k, on: c.id}]}]); propCases++; propMiss += r.findings.length; }
let t = performance.now(); for (let i = 0; i < 200; i++) placeExtras(laid.geometry, panels, scene); const us = (performance.now() - t) / 200 * 1000;
const bytes = nudged.placed.reduce((n, p) => n + p.svg.length, 0);
console.log(JSON.stringify({
  scene: {symbols: nudged.placed.filter(p => p.layer === 'manpu').length, props: nudged.placed.filter(p => p.layer === 'prop').length, firstChoice: first.stats, withCandidates: nudged.stats, findings: nudged.findings, moved: nudged.placed.filter(p => p.triedBefore > 0).map(p => `${p.id} ${p.kind} -> ${p.at} after ${p.triedBefore}`)},
  sweepManpu: {cases: sw1.n, firstChoiceCollisions: sw1.miss, noRoomAfterCandidates: sw2.miss},
  sweepProps: {cases: propCases, noRoom: propMiss},
  deterministic: JSON.stringify(nudged.placed) === JSON.stringify(placeExtras(laid.geometry, panels, scene).placed),
  microsecondsPerScene: +us.toFixed(0), extraSvgBytes: bytes, baseSvgBytes: laid.svg({}).length,
}, null, 1));

const out = process.argv[2];
if (out) {
  fs.mkdirSync(out, {recursive: true});
  const filled: Values = {day: '水曜', what: '引き継ぎ', prep: '資料を共有', change: '早く帰る', wish: '週に一度は早く帰る'};
  const compose = (svg: string, layer: typeof nudged) => { for (const p of sample.panels) { const mark = `<g data-bubble="${p.id}.b0">`; const add = layer.placed.filter(x => x.id.startsWith(`${p.id}.`)).map(x => x.svg).join(''); svg = svg.replace(mark, add + mark); } return svg; };
  const base = laid.svg(filled);
  fs.writeFileSync(`${out}/scene-resolved.svg`, compose(base, nudged));
  fs.writeFileSync(`${out}/scene-first-choice.svg`, compose(base, first));
}
