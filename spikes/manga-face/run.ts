// node spikes/manga-face/run.ts [outdir] — manifests, loadCharacter, sizes, determinism (Node and Chromium), anchors (raster), distinguishability at stage scale,
// contrast over the palette, minimum stroke width, 1000 random seeds, swap compatibility with the built-in faces, and the 4-panel comic() sample. See ADR 0079.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {measureWithFonts} from '../../lib/font-metrics.ts';
import {loadCharacter} from '../../lib/comic/character.ts';
import {comic, diagram, renderInBrowser} from '../../lib/web.ts';
import type {ComicWorksheet} from '../../lib/types/comic.ts';
import {ADR0074, BOX, CHARACTERS, DIRECTIONS, HAIR, INK, SCALE, SKIN, contrast, needsKeyline, randomCharacter, toManifest, validate, KEY_BELOW, type Character} from './face.ts';
import {sheet} from './gallery.ts';

const dir = process.argv[2] ?? path.join(import.meta.dirname, 'out');
fs.mkdirSync(dir, {recursive: true});
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');
const stat: Record<string, unknown> = {};
const r1 = (v: number) => Math.round(v * 10) / 10;

// 1. manifests accepted by loadCharacter (a: young, b: young bob and mirrored, m: mature)
const mature: Character = {...structuredClone(CHARACTERS.a), ...structuredClone(DIRECTIONS.mature), id: 'mf-m', name: '同僚(成熟)', hair: {...CHARACTERS.a.hair, strands: 7}} as Character;
const a = toManifest(CHARACTERS.a), b = toManifest(CHARACTERS.b), m = toManifest(mature);
for (const x of [a, b, m]) loadCharacter(x);
fs.writeFileSync(path.join(dir, 'character-a.json'), `${JSON.stringify(a)}\n`);
stat['loadCharacter'] = 'accepted a, b (mirror), mature';
stat['fragmentBytes'] = Object.fromEntries(ADR0074.map(e => [e, bytes(a.expressions[e]!)]));
stat['manifestBytes'] = {a: bytes(JSON.stringify(a)), b: bytes(JSON.stringify(b)), mature: bytes(JSON.stringify(m))};
stat['pathCount'] = (a.expressions.neutral!.match(/<path/g) ?? []).length;

// 2. determinism: twice, from a deep copy, and in Chromium (the generator bundled with esbuild and run in the page)
stat['deterministic'] = JSON.stringify(a) === JSON.stringify(toManifest(structuredClone(CHARACTERS.a)));
const g1 = sheet(ADR0074);
stat['galleryDeterministic'] = g1 === sheet(ADR0074);
stat['galleryBytes'] = bytes(g1);
const bundle = execFileSync(path.join(import.meta.dirname, '../../node_modules/.bin/esbuild'), [path.join(import.meta.dirname, 'face.ts'), '--bundle', '--format=iife', '--global-name=MF', '--platform=browser', '--log-level=error'], {encoding: 'utf8'});
const {chromium} = await import('playwright-chromium');
const br = await chromium.launch(), page = await br.newPage();
await page.setContent('<body></body>');
await page.addScriptTag({content: bundle});
const inChromium = await page.evaluate((chs) => (window as any).MF.toManifest(chs.a) && JSON.stringify((window as any).MF.toManifest(chs.a)), {a: CHARACTERS.a});
stat['chromiumIdentical'] = inChromium === JSON.stringify(a);
stat['chromiumIdenticalAll'] = await page.evaluate((chs) => JSON.stringify([(window as any).MF.toManifest(chs.b), (window as any).MF.toManifest(chs.m)]), {b: CHARACTERS.b, m: mature}) === JSON.stringify([b, m]);

// 3. anchors by raster: the first non-transparent row of every expression, against the declared `top` (no tolerance), and the mouth anchor
const SC = 4;
const rasterTop = async (x: typeof a, e: string) => page.evaluate(async ({box, frag, sc}) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${box[2]! * sc}" height="${box[3]! * sc}">${frag}</svg>`;
  const img = new Image(); await new Promise<void>(res => { img.onload = () => res(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); });
  const c = document.createElement('canvas'); c.width = box[2]! * sc; c.height = box[3]! * sc; const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  for (let y = 0; y < c.height; y++) for (let x2 = 0; x2 < c.width; x2++) if (d[(y * c.width + x2) * 4 + 3]! > 8) return box[1]! + y / sc;
  return null;
}, {box: [...x.box], frag: x.expressions[e as 'neutral']!, sc: SC});
const anchors: Record<string, unknown> = {};
for (const [k, x] of [['a', a], ['b', b], ['mature', m]] as const) {
  const tops = await Promise.all(ADR0074.map(e => rasterTop(x, e)));
  const minTop = Math.min(...(tops as number[]));
  anchors[k] = {declaredTop: x.anchors.top, rasterTop: minTop, ok: x.anchors.top! <= minTop, headTopMinusTop: r1(x.anchors.head.cy - x.anchors.head.r - x.anchors.top!)};
}
stat['anchors'] = anchors;

// 4. distinguishability at stage scale (head r = 36 px, DPR 1): mean absolute grey difference over the face rectangle, for the 28 pairs of the 8 expressions
const pw = Math.round(BOX[2] * SCALE), ph = Math.round(BOX[3] * SCALE);
const rect = {x0: Math.round((60 - BOX[0]) * SCALE), x1: Math.round((240 - BOX[0]) * SCALE), y0: Math.round((80 - BOX[1]) * SCALE), y1: Math.round((250 - BOX[1]) * SCALE)};
const dist: Record<string, unknown> = {};
const grid = async (x: typeof a) => page.evaluate(async ({box, frags, pw, ph, rect}) => {
  const px: number[][] = [];
  for (const f of frags) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${pw}" height="${ph}"><rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="#ffffff"/>${f}</svg>`;
    const img = new Image(); await new Promise<void>(res => { img.onload = () => res(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); });
    const c = document.createElement('canvas'); c.width = pw; c.height = ph; const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, pw, ph).data; const o: number[] = []; for (let i = 0; i < d.length; i += 4) o.push(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!); px.push(o);
  }
  const out: Record<string, number> = {};
  for (let i = 0; i < px.length; i++) for (let j = i + 1; j < px.length; j++) { let s = 0, n = 0; for (let y = rect.y0; y < rect.y1; y++) for (let x2 = rect.x0; x2 < rect.x1; x2++) { s += Math.abs(px[i]![y * pw + x2]! - px[j]![y * pw + x2]!); n++; } out[`${i}-${j}`] = s / n; }
  return out;
}, {box: [...x.box], frags: ADR0074.map(e => x.expressions[e]!), pw, ph, rect});
const THRESHOLD = 6;
for (const [k, x] of [['a', a], ['b', b], ['mature', m]] as const) {
  const g = await grid(x); const entries = Object.entries(g).sort((p, q) => p[1] - q[1]);
  const name = (key: string) => key.split('-').map(i => ADR0074[Number(i)]).join('/');
  dist[k] = {min: r1(entries[0]![1] * 10) / 10, lowest3: entries.slice(0, 3).map(([kk, v]) => `${name(kk)}=${r1(v)}`), below: entries.filter(([, v]) => v < THRESHOLD).map(([kk, v]) => `${name(kk)}=${r1(v)}`)};
}
stat['distinguishability'] = {threshold: THRESHOLD, stage: `${pw}x${ph}px`, ...dist};
await br.close();

// 5. contrast over the palette: every skin x feature line (ink) is either >= 4.5:1 or drawn with a paper keyline; ink / paper; hair x skin is not guaranteed (as in ADR 0076)
const skinRows = Object.entries(SKIN).map(([k, v]) => ({skin: k, ink: r1(contrast(INK, v)), keyed: needsKeyline(v)}));
const keyedOk = Object.values(SKIN).every(v => contrast(INK, v) >= KEY_BELOW || needsKeyline(v));
const keyedFragment = (skin: keyof typeof SKIN) => toManifest({...CHARACTERS.a, id: 'k', palette: {...CHARACTERS.a.palette, skin}}).expressions.smile!.includes('stroke-width="9.2"') || toManifest({...CHARACTERS.a, id: 'k', palette: {...CHARACTERS.a.palette, skin}}).expressions.smile!.includes('stroke="#ffffff" stroke-width="9');
void keyedFragment;
stat['contrast'] = {inkOnPaper: r1(contrast(INK, '#ffffff')), skins: skinRows, everySkinPasses: keyedOk, hairOnSkinBelow3: Object.entries(HAIR).flatMap(([h, hv]) => Object.entries(SKIN).map(([s, sv]) => ({h, s, c: contrast(hv, sv)}))).filter(p => p.c < 3).length + ' of 36 (not guaranteed; the hair-face boundary has a keyline)'};
stat['allPalettePairs'] = (() => { let ok = 0, bad = 0; for (const s of Object.keys(SKIN)) for (const h of Object.keys(HAIR)) { const frag = toManifest({...CHARACTERS.a, id: 'p', palette: {...CHARACTERS.a.palette, skin: s, hair: h}}).expressions.neutral!; const keyedHas = /stroke="#ffffff" stroke-width="9\.2"|stroke="#ffffff" stroke-width="[0-9.]+" stroke-linecap="round"/.test(frag); if (needsKeyline((SKIN as Record<string, string>)[s]!) === keyedHas) ok++; else bad++; } return {pairs: ok + bad, consistent: ok, inconsistent: bad}; })();

// 6. minimum stroke width at stage scale: every stroke of an open line (fill none) is >= 2.8 units (1 px at 0.36)
const strokes = (frag: string) => [...frag.matchAll(/<(?:path|ellipse|circle)[^>]*?fill="none"[^>]*?stroke-width="([0-9.]+)"/g)].map(x => Number(x[1]));
const minStroke = Math.min(...[a, b, m].flatMap(x => Object.values(x.expressions).flatMap(f => strokes(f!))));
stat['minStrokeUnits'] = {min: minStroke, px: r1(minStroke * SCALE), ok: minStroke * SCALE >= 1};

// 7. random seeds: every seed must produce a valid character that loadCharacter accepts
let okSeeds = 0, retried = 0; const reasons: Record<string, number> = {};
for (let i = 0; i < 1000; i++) {
  const c = randomCharacter(i);
  const bad = validate(c);
  if (bad.length) { for (const x of bad) reasons[x.replace(/[-0-9.]+/g, '#').slice(0, 60)] = (reasons[x.replace(/[-0-9.]+/g, '#').slice(0, 60)] ?? 0) + 1; continue; }
  loadCharacter(toManifest(c)); okSeeds++;
  if (c.name.includes('#')) retried++;
}
stat['randomSeeds'] = {tried: 1000, valid: okSeeds, rejected: 1000 - okSeeds, retriedWithNextAttempt: retried, reasons};
stat['seedStable'] = JSON.stringify(randomCharacter(7)) === JSON.stringify(randomCharacter(7));
// invalid input: strands 0, chin 110
const bad0 = validate({...CHARACTERS.a, hair: {...CHARACTERS.a.hair, strands: 0}} as Character);
stat['invalidInputs'] = {strands0: bad0, chin110: validate({...CHARACTERS.a, head: {...CHARACTERS.a.head, chin: 110}} as Character)};
let threw = false; try { toManifest({...CHARACTERS.a, hair: {...CHARACTERS.a.hair, strands: 0}} as Character); } catch { threw = true; }
stat['toManifestThrowsOnInvalid'] = threw;
let mapErr = ''; try { toManifest(CHARACTERS.a, ADR0074, {think: 'cry'}); } catch (e) { mapErr = String((e as Error).message).slice(0, 80); }
stat['expressionMapRejectsDifferentMeaning'] = mapErr;
stat['expressionMapAcceptsSameMeaning'] = (() => { const x = toManifest(CHARACTERS.a, ADR0074, {sad: 'cry', angry: 'clench'}); loadCharacter(x); return Object.keys(x.expressions).length; })();

// 8. the 4-panel sample with the two characters (renderInBrowser + comic())
const sample: ComicWorksheet = {version: 1, title: '確認の会話', layout: '2x2', cast: {me: {name: '私', asset: 'mf-a'}, col: {name: '同僚', asset: 'mf-b'}}, panels: [
  {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression: 'smile'}], dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: 'ここが変更点です。'}]},
  {id: 'p2', stage: [{who: 'me', at: 'left', expression: 'surprise'}, {who: 'col', at: 'right', expression: 'think'}], dialogue: [{id: 'd1', who: 'col', kind: 'say', tpl: '要確認ですね。'}]},
  {id: 'p3', stage: [{who: 'me', at: 'left', expression: 'worry'}, {who: 'col', at: 'right', expression: 'angry'}], dialogue: [{id: 'd1', who: 'me', kind: 'think', tpl: '間に合うかな…'}]},
  {id: 'p4', stage: [{who: 'me', at: 'left', expression: 'laugh'}, {who: 'col', at: 'right', expression: 'sad'}], dialogue: [{id: 'd1', who: 'col', kind: 'say', tpl: 'あとで見ます。'}]},
]};
const hb = ({text, size}: {text: string; size: number}) => ({w: measureWithFonts(new Map([['k', {text, size, weight: 400, font: 'sans' as const}]])).get('k')!.w, h: size});
const render = () => renderInBrowser(diagram({theme: 'blue', title: sample.title, width: 780, legend: false}).add(comic(sample, {aspect: '6:5', characters: {'mf-a': a, 'mf-b': b}})), {measure: hb});
const c1 = await render(), c2 = await render();
fs.writeFileSync(path.join(dir, 'comic-sample.svg'), c1.svg);
stat['comic'] = {deterministic: c1.svg === c2.svg, svgBytes: bytes(c1.svg), verdictOk: c1.verdict.ok, faces: (c1.svg.match(/data-character=/g) ?? []).length};

// 9. swap compatibility (ADR 0079 D7): a 1x2 comic with two stacked bubbles per panel, lines of 8..66 characters. Built-in faces vs manga faces (no tuft, and with a side tuft)
const tuft: Character = {...structuredClone(CHARACTERS.a), id: 'mf-t', hair: {...CHARACTERS.a.hair, ahoge: 'right'}};
const mt = toManifest(tuft);
const chars = {'mf-a': a, 'mf-b': b, 'mf-t': mt};
const base = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソ';
const swap: Record<string, {ok: number; fail: number}> = {builtin: {ok: 0, fail: 0}, manga: {ok: 0, fail: 0}, mangaTuft: {ok: 0, fail: 0}};
const regress: string[] = [];
for (let len = 8; len <= 66; len += 2) {
  const lines = base.slice(0, len);
  const res: Record<string, boolean> = {};
  for (const [label, cast] of [['builtin', {me: {name: '私', face: {hue: 200}}, col: {name: '同僚', face: {hue: 20}}}], ['manga', {me: {name: '私', asset: 'mf-a'}, col: {name: '同僚', asset: 'mf-b'}}], ['mangaTuft', {me: {name: '私', asset: 'mf-t'}, col: {name: '同僚', asset: 'mf-b'}}]] as const) {
    const ws: ComicWorksheet = {version: 1, title: 'Zone', layout: '1x2', cast, panels: [{id: 'p0', stage: [{who: 'me', at: 'left', expression: 'neutral'}], dialogue: []}, {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression: 'smile'}], dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: lines}, {id: 'd2', who: 'col', kind: 'say', tpl: lines}]}]};
    const r = await renderInBrowser(diagram({theme: 'blue', width: 500, legend: false}).add(comic(ws, {aspect: '6:5', characters: chars})), {measure: hb});
    const ok = r.verdict.problems.filter((x: string) => !x.includes('text-budget')).length === 0;
    res[label] = ok; swap[label]![ok ? 'ok' : 'fail']++;
  }
  if (res['builtin'] && !res['manga']) regress.push(`manga@${len}`);
  if (res['builtin'] && !res['mangaTuft']) regress.push(`tuft@${len}`);
}
stat['swapCompatibility'] = {lengthsTried: 30, ...swap, regressions: regress};
stat['topAnchors'] = {a: a.anchors.top, tuft: mt.anchors.top, b: b.anchors.top, builtinTopIs: 'head top = 40', limit: 23};

fs.writeFileSync(path.join(dir, 'measurements.json'), `${JSON.stringify(stat, null, 2)}\n`);
console.log(JSON.stringify(stat, null, 2));
