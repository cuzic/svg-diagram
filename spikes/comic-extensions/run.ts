// node spikes/comic-extensions/run.ts [outdir] — manpu / props on the ADR 0074 prototype: collision check, fallbacks per anchor, `center`, determinism, size, timing.
import fs from 'node:fs';
import {measureWithFonts} from '../../lib/font-metrics.ts';
import {layoutComic, type Values, type Worksheet} from '../comic-worksheet/proto.ts';
import {sample} from '../comic-worksheet/sample.ts';
import {placeExtras, type ManpuKind, type PanelExtras, type Placed, type PropKind} from './manpu.ts';

const hb = (text: string, size: number, weight = 400) => measureWithFonts(new Map([['k', {text, size, weight, font: 'sans' as const}]])).get('k')!.w;
// the 4 panels of the ADR 0074 sample (two people, left and right) plus one invented panel with three people (left, center, right): `center` is exercised
const three: Worksheet = {panels: [{id: 'q1', chars: [{id: 'me', side: 'left', face: 'smile', hue: 210}, {id: 'col', side: 'center', face: 'neutral', hue: 20}, {id: 'boss', side: 'right', face: 'think', hue: 120}],
  lines: [{speaker: 'col', kind: 'say', tpl: '資料は見ましたか？'}, {speaker: 'me', kind: 'say', tpl: 'はい、確認しました。'}]}]};
const sheets = {two: sample, three};
const laid = {two: layoutComic(sample, hb), three: layoutComic(three, hb)};
const info = (ws: Worksheet) => ws.panels.map(p => ({id: p.id, lineSpeakers: p.lines.map(l => l.speaker)}));
const sides = (ws: Worksheet, id: string) => Object.fromEntries(ws.panels.find(p => p.id === id)!.chars.map(c => [c.id, c.side])) as Record<string, 'left' | 'center' | 'right'>;
const place = (k: 'two' | 'three', extras: PanelExtras[], nudge = true) => placeExtras(laid[k].geometry, info(sheets[k]), extras, {nudge});

// one scene: 7 marks + 5 props = 12 requested on the two-person sample
const scene: PanelExtras[] = [
  {panel: 'p1', side: sides(sample, 'p1'), manpu: [{kind: 'sparkle', on: 'me'}], props: [{kind: 'documents', on: 'me', at: 'hand'}]},
  {panel: 'p2', side: sides(sample, 'p2'), manpu: [{kind: 'exclaim', on: 'col'}, {kind: 'sweat', on: 'me'}], props: [{kind: 'coffee', on: 'col', at: 'hand'}]},
  {panel: 'p3', side: sides(sample, 'p3'), manpu: [{kind: 'question', on: 'me'}, {kind: 'sweat', on: 'col'}], props: [{kind: 'pc', on: 'me', at: 'floor'}, {kind: 'clock', on: 'col', at: 'wall-out'}]},
  {panel: 'p4', side: sides(sample, 'p4'), manpu: [{kind: 'heart', on: 'me'}, {kind: 'sparkle', on: 'col'}], props: [{kind: 'calendar', on: 'col', at: 'wall-out'}]},
];
const first = place('two', scene, false), nudged = place('two', scene);
const requested = scene.reduce((n, e) => n + (e.manpu?.length ?? 0) + (e.props?.length ?? 0), 0);

// sweeps: every kind x every character, one item at a time
const kinds: ManpuKind[] = ['sweat', 'anger', 'sparkle', 'question', 'exclaim', 'heart', 'sigh', 'idea', 'gloom', 'zzz'];
const propKinds: PropKind[] = ['pc', 'coffee', 'calendar', 'clock', 'documents', 'phone'];
const anchors = ['hand', 'floor', 'wall-out', 'wall-in'] as const;
interface Row {sheet: string; panel: string; who: string; side: string}
const chars: Row[] = [...sample.panels.flatMap(p => p.chars.map(c => ({sheet: 'two' as const, panel: p.id, who: c.id, side: c.side}))), ...three.panels.flatMap(p => p.chars.map(c => ({sheet: 'three' as const, panel: p.id, who: c.id, side: c.side})))];
const one = (r: Row, extra: Partial<PanelExtras>, nudge = true) => place(r.sheet as 'two' | 'three', [{panel: r.panel, side: sides(sheets[r.sheet as 'two' | 'three'], r.panel), ...extra}], nudge);
const markSweep = (nudge: boolean) => { let n = 0, bad = 0; const lost: string[] = []; for (const r of chars) for (const k of kinds) { const l = one(r, {manpu: [{kind: k, on: r.who}]}, nudge); n++; bad += nudge ? l.findings.length : l.stats.firstChoiceHits; if (nudge && l.findings.length) lost.push(`${r.panel}.${r.who}`); } return {n, bad, lost: [...new Set(lost)]}; };
const m1 = markSweep(false), m2 = markSweep(true);
const bySide: Record<string, {cases: number; firstHit: number}> = {};
for (const r of chars) for (const k of kinds) { const l = one(r, {manpu: [{kind: k, on: r.who}]}, false); const b = (bySide[r.side] ??= {cases: 0, firstHit: 0}); b.cases++; b.firstHit += l.stats.firstChoiceHits; }
// props: for each requested anchor, how often is it honoured, and where do the others go
const propReport: Record<string, {cases: number; honoured: number; fell: Record<string, number>; lost: number}> = {};
for (const r of chars) for (const a of anchors) for (const k of propKinds) { const l = one(r, {props: [{kind: k, on: r.who, at: a}]}); const e = (propReport[a] ??= {cases: 0, honoured: 0, fell: {}, lost: 0}); e.cases++; const p = l.placed[0]; if (!p) e.lost++; else if (p.at === a) e.honoured++; else e.fell[p.at] = (e.fell[p.at] ?? 0) + 1; }
const centerRows = chars.filter(r => r.side === 'center').length;

// timing: the median and the worst of 41 runs of the whole scene (the first runs are warm-up and are dropped)
const times: number[] = []; for (let i = 0; i < 51; i++) { const t = performance.now(); place('two', scene); if (i >= 10) times.push((performance.now() - t) * 1000); }
times.sort((a, b) => a - b);
const deterministic = JSON.stringify(nudged.placed) === JSON.stringify(place('two', scene).placed);
const moved = (l: {placed: Placed[]}) => l.placed.filter(p => p.at !== p.wanted).map(p => `${p.id} ${p.kind}: ${p.wanted} -> ${p.at}`);
console.log(JSON.stringify({
  scene: {requested, markRequested: scene.reduce((n, e) => n + (e.manpu?.length ?? 0), 0), propRequested: scene.reduce((n, e) => n + (e.props?.length ?? 0), 0), placed: nudged.placed.length, notPlaced: nudged.findings.map(f => `${f.rule} ${f.where}`), firstChoiceOnly: first.stats, withCandidates: nudged.stats, notAtRequestedAnchor: moved(nudged)},
  sweepMarks: {cases: m1.n, firstChoiceCollisions: m1.bad, noRoomAfterCandidates: m2.bad, noRoomCharacters: m2.lost, firstChoiceCollisionsBySide: bySide, centerCharacters: centerRows},
  sweepPropsByRequestedAnchor: propReport,
  deterministic, microsecondsPerScene: {median: Math.round(times[Math.floor(times.length / 2)]!), p90: Math.round(times[Math.floor(times.length * 0.9)]!), max: Math.round(times.at(-1)!)}, extraSvgBytes: nudged.placed.reduce((n, p) => n + p.svg.length, 0), baseSvgBytes: laid.two.svg({}).length,
}, null, 1));

const out = process.argv[2];
if (out) {
  fs.mkdirSync(out, {recursive: true});
  const filled: Values = {day: '水曜', what: '引き継ぎ', prep: '資料を共有', change: '早く帰る', wish: '週に一度は早く帰る'};
  const compose = (svg: string, layer: {placed: Placed[]}, ws: Worksheet) => { for (const p of ws.panels) { const mark = `<g data-bubble="${p.id}.b0">`; svg = svg.replace(mark, layer.placed.filter(x => x.id.startsWith(`${p.id}.`)).map(x => x.svg).join('') + mark); } return svg; };
  fs.writeFileSync(`${out}/scene-resolved.svg`, compose(laid.two.svg(filled), nudged, sample));
  fs.writeFileSync(`${out}/scene-first-choice.svg`, compose(laid.two.svg(filled), first, sample));
  const q = place('three', [{panel: 'q1', side: sides(three, 'q1'), props: [{kind: 'documents', on: 'me', at: 'hand'}, {kind: 'coffee', on: 'col', at: 'hand'}, {kind: 'phone', on: 'boss', at: 'hand'}], manpu: [{kind: 'sweat', on: 'me'}, {kind: 'question', on: 'col'}, {kind: 'sparkle', on: 'boss'}]}]);
  fs.writeFileSync(`${out}/three-people.svg`, compose(laid.three.svg({}), q, three));
}
