// node spikes/manga-face/run.ts [outdir] — manifests, loadCharacter, sizes, determinism (Node and Chromium), anchors (raster), distinguishability at stage scale,
// pixel checks of the feature lines and the keylines, contrast over the palette, minimum stroke width, the sampler's validity, swap compatibility with the
// built-in faces, and the 4-panel comic() sample. See ADR 0079.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {measureWithFonts} from '../../lib/font-metrics.ts';
import {loadCharacter} from '../../lib/comic/character.ts';
import {comic, diagram, renderInBrowser} from '../../lib/web.ts';
import type {ComicWorksheet} from '../../lib/types/comic.ts';
import {ADR0074, BOX, CHARACTERS, HAIR, INK, KEY_BELOW, SCALE, SKIN, GENERATOR, contrast, faceFragment, needsKeyline, normalize, randomCharacter, randomCharacterDetailed, toManifest, validate, RANGES, type Character} from './face.ts';
import {sheet} from './gallery.ts';

const dir = process.argv[2] ?? path.join(import.meta.dirname, 'out');
fs.mkdirSync(dir, {recursive: true});
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');
const stat: Record<string, unknown> = {};
const r1 = (v: number) => Math.round(v * 10) / 10;
const EXTRA = ['shy', 'smug', 'deadpan', 'clench', 'cry', 'blank'];

// 1. manifests accepted by loadCharacter (a: young, b: young bob and mirrored, m: mature)
const a = toManifest(CHARACTERS.a), b = toManifest(CHARACTERS.b), m = toManifest(CHARACTERS.m);
for (const x of [a, b, m]) loadCharacter(x);
fs.writeFileSync(path.join(dir, 'character-a.json'), `${JSON.stringify(a)}\n`);
stat['loadCharacter'] = 'accepted a, b (mirror), m (mature)';
stat['fragmentBytes'] = Object.fromEntries(ADR0074.map(e => [e, bytes(a.expressions[e]!)]));
stat['extrasFragmentBytes'] = Object.fromEntries(EXTRA.map(e => [e, bytes(faceFragment(CHARACTERS.a, e).fragment)]));
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
const rnd = Array.from({length: 40}, (_, i) => randomCharacter(i));
const inNode = JSON.stringify([a, b, m, ...rnd.map(c => toManifest(c))]);
const inChromium = await page.evaluate(({cs, seeds}) => JSON.stringify([...cs.map((c: any) => (window as any).MF.toManifest(c)), ...seeds.map((s: number) => (window as any).MF.toManifest((window as any).MF.randomCharacter(s)))]), {cs: [CHARACTERS.a, CHARACTERS.b, CHARACTERS.m], seeds: rnd.map((_, i) => i)});
stat['chromiumIdentical'] = {characters: 3 + rnd.length, identical: inNode === inChromium};

// helpers that run in the page: render an SVG string to RGBA at a scale
const rasterJs = `window.__ras = async (box, frag, sc, bg) => { const w = Math.round(box[2] * sc), h = Math.round(box[3] * sc);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + box.join(' ') + '" width="' + w + '" height="' + h + '">' + (bg ? '<rect x="' + box[0] + '" y="' + box[1] + '" width="' + box[2] + '" height="' + box[3] + '" fill="#ffffff"/>' : '') + frag + '</svg>';
  const img = new Image(); await new Promise(res => { img.onload = () => res(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); });
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return {w, h, d: Array.from(g.getImageData(0, 0, w, h).data)}; };`;
await page.addScriptTag({content: rasterJs});

// 3. anchors by raster: the first non-transparent row of every expression, against the declared `top` (no tolerance)
const SC = 4;
const anchors: Record<string, unknown> = {};
for (const [k, x] of [['a', a], ['b', b], ['mature', m]] as const) {
  const tops: number[] = [];
  for (const e of ADR0074) {
    const r = await page.evaluate(async ({box, frag, sc}) => { const q = await (window as any).__ras(box, frag, sc, false); for (let y = 0; y < q.h; y++) for (let x2 = 0; x2 < q.w; x2++) if (q.d[(y * q.w + x2) * 4 + 3] > 8) return box[1]! + y / sc; return null; }, {box: [...x.box], frag: x.expressions[e]!, sc: SC});
    tops.push(r as number);
  }
  const minTop = Math.min(...tops);
  anchors[k] = {declaredTop: x.anchors.top, rasterTop: minTop, ok: x.anchors.top! <= minTop, atLeast23: x.anchors.top! >= 23};
}
stat['anchors'] = anchors;

// 4. distinguishability at stage scale (head r = 36 px, DPR 1). The rectangle is the head circle's bounding square: x in [cx - r, cx + r], y in [cy - r, cy + r].
// Mean absolute grey difference over it, for the 28 pairs of the 8 expressions. Evaluated over the 3 showcase characters, 64 random seeds, and the palette extremes.
const pw = Math.round(BOX[2] * SCALE), ph = Math.round(BOX[3] * SCALE);
const rect = {x0: Math.round((50 - BOX[0]) * SCALE), x1: Math.round((250 - BOX[0]) * SCALE), y0: Math.round((40 - BOX[1]) * SCALE), y1: Math.round((240 - BOX[1]) * SCALE)};
const THRESHOLD = 6;
const distinct = async (ch: Character): Promise<{min: number; pair: string}> => {
  const frags = ADR0074.map(e => faceFragment(ch, e).fragment);
  const res = await page.evaluate(async ({box, frags, rect}) => {
    const px: number[][] = [];
    for (const f of frags) { const q = await (window as any).__ras(box, f, 0.36, true); const o: number[] = []; for (let i = 0; i < q.d.length; i += 4) o.push(0.299 * q.d[i] + 0.587 * q.d[i + 1] + 0.114 * q.d[i + 2]); px.push(o); }
    const pw = Math.round(box[2]! * 0.36); let best = 1e9, pair = '';
    for (let i = 0; i < px.length; i++) for (let j = i + 1; j < px.length; j++) { let s = 0, n = 0; for (let y = rect.y0; y < rect.y1; y++) for (let x = rect.x0; x < rect.x1; x++) { s += Math.abs(px[i]![y * pw + x]! - px[j]![y * pw + x]!); n++; } if (s / n < best) { best = s / n; pair = `${i}-${j}`; } }
    return {min: best, pair};
  }, {box: [...BOX], frags, rect});
  return {min: res.min, pair: res.pair.split('-').map(i => ADR0074[Number(i)]).join('/')};
};
const showcase = await Promise.all((['a', 'b', 'm'] as const).map(async k => [k, await distinct(CHARACTERS[k])] as const));
const randomSet = await Promise.all(Array.from({length: 64}, async (_, i) => [i, await distinct(randomCharacter(i))] as const));
const extremes: [string, {min: number; pair: string}][] = [];
for (const dirn of ['a', 'm'] as const) for (const skin of Object.keys(SKIN)) for (const hair of ['black', 'blond']) extremes.push([`${dirn}/${skin}/${hair}`, await distinct({...structuredClone(CHARACTERS[dirn]), mirror: false, palette: {...CHARACTERS[dirn].palette, skin, hair}} as Character)]);
const mins = (xs: {min: number}[]) => { const v = xs.map(x => x.min).sort((p, q) => p - q); return {n: v.length, min: r1(v[0]!), p10: r1(v[Math.floor(v.length * 0.1)]!), median: r1(v[Math.floor(v.length / 2)]!), below6: v.filter(x => x < THRESHOLD).length}; };
stat['distinguishability'] = {threshold: THRESHOLD, stage: `${pw}x${ph}px`, rect: 'head circle bounding square', showcase: Object.fromEntries(showcase.map(([k, v]) => [k, `${r1(v.min)} (${v.pair})`])), random64: mins(randomSet.map(x => x[1])), paletteExtremes: mins(extremes.map(x => x[1])), worstRandom: randomSet.map(x => x[1]).sort((p, q) => p.min - q.min).slice(0, 3).map(x => `${r1(x.min)} ${x.pair}`), worstExtreme: extremes.sort((p, q) => p[1].min - q[1].min).slice(0, 3).map(x => `${x[0]} ${r1(x[1].min)} ${x[1].pair}`)};

// 5. pixel checks (stage scale x3 = 1.08 px per unit): (a) every line feature's ink edge sees paper or a fill with >= 3:1 against ink;
//    (b) each boundary keyline changes the picture (>= 100 px); with a negative control (feature keylines off)
const lineCheck = async (chs: Character[], exprs: string[], noKey: boolean) => {
  const pairs = chs.flatMap(c => exprs.map(e => ({full: faceFragment(c, e, {features: 'lines', noFeatureKeyline: noKey}).fragment, bare: faceFragment(c, e, {features: false}).fragment, c: c.id, e})));
  return page.evaluate(async ({box, pairs, ink}) => {
    const lumv = (r: number, g: number, b: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const li = lumv(ink[0]!, ink[1]!, ink[2]!); const cr = (r: number, g: number, b: number) => { const l = lumv(r, g, b); return (Math.max(l, li) + 0.05) / (Math.min(l, li) + 0.05); };
    let worst = 1, failing: string[] = [], edgeTotal = 0;
    for (const p of pairs) {
      const A = await (window as any).__ras(box, p.full, 1.08, false), B = await (window as any).__ras(box, p.bare, 1.08, false);
      const w = A.w, h = A.h; let pass = 0, edge = 0;
      const isInk = (i: number) => Math.abs(A.d[i] - ink[0]!) + Math.abs(A.d[i + 1] - ink[1]!) + Math.abs(A.d[i + 2] - ink[2]!) < 70 && A.d[i + 3] > 200;
      for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
        const i = (y * w + x) * 4;
        if (!isInk(i)) continue;
        if (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2]) < 24) continue; // not a feature pixel
        let sees = false, hasOut = false;
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3], [4, 0], [-4, 0], [0, 4], [0, -4], [2, 2], [-2, -2], [2, -2], [-2, 2]] as const) {
          const j = ((y + dy) * w + x + dx) * 4;
          if (isInk(j)) continue;
          hasOut = true;
          if (cr(A.d[j], A.d[j + 1], A.d[j + 2]) >= 3) sees = true;
        }
        if (!hasOut) continue;
        edge++; if (sees) pass++;
      }
      edgeTotal += edge;
      const frac = edge ? pass / edge : 1;
      if (frac < worst) worst = frac;
      if (frac < 0.95) failing.push(`${p.c}/${p.e}=${Math.round(frac * 100)}%`);
    }
    return {worstFraction: worst, failing: failing.length, failingSample: failing.slice(0, 4), edgePixels: edgeTotal, cases: pairs.length};
  }, {box: [...BOX], pairs, ink: [0x22, 0x20, 0x1b]});
};
const skins = Object.keys(SKIN), hairs = ['black', 'blond', 'navy'];
const grid: Character[] = skins.flatMap(s => hairs.map(h => ({...structuredClone(CHARACTERS.a), id: `${s}-${h}`, mirror: false, palette: {...CHARACTERS.a.palette, skin: s, hair: h}} as Character)));
const exprs = [...ADR0074, ...EXTRA];
stat['featurePixels'] = {...(await lineCheck(grid, exprs, false)), grid: `${skins.length} skins x ${hairs.length} hairs x ${exprs.length} expressions`};
stat['featurePixelsControlNoKeyline'] = await lineCheck(grid, exprs, true);
const keyChanges = async (kind: 'hairFace' | 'faceNeck') => page.evaluate(async ({box, pairs}) => { const out: number[] = []; for (const p of pairs) { const A = await (window as any).__ras(box, p.on, 1.08, true), B = await (window as any).__ras(box, p.off, 1.08, true); let n = 0; for (let i = 0; i < A.d.length; i += 4) if (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2]) > 24) n++; out.push(n); } return out; },
  {box: [...BOX], pairs: [CHARACTERS.a, CHARACTERS.b, CHARACTERS.m].map(c => ({on: faceFragment(c, 'neutral').fragment, off: faceFragment(c, 'neutral', {noKeyline: kind}).fragment}))});
stat['keylineChangesPixels'] = {hairFace: await keyChanges('hairFace'), faceNeck: await keyChanges('faceNeck'), requireAtLeast: 100};
await br.close();

// 6. which skins are keyed (feature lines get a paper line under them): ink under 3:1 against the skin
stat['contrast'] = {inkOnPaper: r1(contrast(INK, '#ffffff')), keylineBelow: KEY_BELOW, skins: Object.entries(SKIN).map(([k, v]) => ({skin: k, ink: r1(contrast(INK, v)), keyed: needsKeyline(v)})), hairs: Object.entries(HAIR).map(([k, v]) => ({hair: k, ink: r1(contrast(INK, v)), browsKeyed: needsKeyline(v)})),
  hairOnSkinBelow3: Object.entries(HAIR).flatMap(([h, hv]) => Object.entries(SKIN).map(([s, sv]) => ({h, s, c: contrast(hv, sv)}))).filter(p => p.c < 3).length + ' of 36 (not guaranteed; the hair-face boundary has a keyline)'};

// 7. minimum stroke width at stage scale: every open line (fill none) is >= 2.8 units (1 px at 0.36)
const strokes = (frag: string) => [...frag.matchAll(/<(?:path|ellipse|circle)[^>]*?fill="none"[^>]*?stroke-width="([0-9.]+)"/g)].map(x => Number(x[1]));
const minStroke = Math.min(...[a, b, m].flatMap(x => Object.values(x.expressions).flatMap(f => strokes(f!))));
stat['minStrokeUnits'] = {min: minStroke, px: r1(minStroke * SCALE), ok: minStroke * SCALE >= 1};

// 8. the sampler: first-draw validity, repair, totality; the coarse grid; invalid input
const N = 1000; let first = 0, repairedN = 0, invalidAfter = 0; const repairGroups: Record<string, number> = {};
for (let i = 0; i < N; i++) { const d = randomCharacterDetailed(i); if (d.firstDrawValid) first++; else { repairedN++; for (const g of d.repaired) repairGroups[g] = (repairGroups[g] ?? 0) + 1; } if (validate(d.character).length) invalidAfter++; else loadCharacter(toManifest(d.character)); }
stat['randomSeeds'] = {generator: GENERATOR, tried: N, firstDrawValid: first, firstDrawRate: `${(first / N * 100).toFixed(1)}%`, repaired: repairedN, repairedGroups: repairGroups, invalidAfterRepair: invalidAfter};
stat['seedStable'] = JSON.stringify(randomCharacter(7)) === JSON.stringify(randomCharacter(7));
stat['seedSnapshot'] = Object.fromEntries([0, 1, 2].map(i => { const c = randomCharacter(i); return [String(i), `cheek ${c.head.cheek} chin ${c.head.chin} jaw ${c.head.jaw} eyes ${c.eyes.w}x${c.eyes.h} ${c.hair.template}/${c.hair.strands} ${c.palette.skin}/${c.palette.hair}`]; }));
// coarse grid: 'normalize' applies the dependent constraints; how much of the grid is still invalid, and why
let gridN = 0, gridBad = 0; const gridWhy: Record<string, number> = {};
for (const cheek of [74, 80, 86, 92, 96]) for (const chin of [90, 94, 98]) for (const strands of [1, 5, 9]) for (const parting of [-1, 0, 1]) for (const template of ['short', 'bob'] as const) for (const dirn of ['a', 'm'] as const) {
  const c = {...structuredClone(CHARACTERS[dirn]), mirror: false, head: {...CHARACTERS[dirn].head, cheek, chin}, hair: {...CHARACTERS[dirn].hair, strands, parting, template}} as Character;
  gridN++; const bad = validate(c); if (bad.length) { gridBad++; for (const x of new Set(bad.map(v => v.replace(/^[a-z]+: /, '').replace(/[-0-9.]+/g, '#').slice(0, 45)))) gridWhy[x] = (gridWhy[x] ?? 0) + 1; }
}
stat['coarseGrid'] = {points: gridN, invalid: gridBad, rate: `${(gridBad / gridN * 100).toFixed(1)}%`, why: gridWhy};
const bad0 = validate({...CHARACTERS.a, hair: {...CHARACTERS.a.hair, strands: 0}} as Character);
stat['invalidInputs'] = {strands0: bad0, chin110: validate({...CHARACTERS.a, head: {...CHARACTERS.a.head, chin: 110}} as Character),
  badHex: validate({...CHARACTERS.a, palette: {...CHARACTERS.a.palette, skin: '#12345'}} as Character), unknownKey: validate({...CHARACTERS.a, palette: {...CHARACTERS.a.palette, hair: 'green'}} as Character)};
let threw = false; try { toManifest({...CHARACTERS.a, hair: {...CHARACTERS.a.hair, strands: 0}} as Character); } catch { threw = true; }
stat['toManifestThrowsOnInvalid'] = threw;
// a palette hex that equals paper or ink is moved by one unit and stays a 6-digit hex that loadCharacter accepts (the bug was #1000000)
const edge = toManifest({...CHARACTERS.a, id: 'edge', palette: {skin: '#ffffff', hair: '#22201b', top: '#fffff0', iris: '#ffffff'}} as Character);
loadCharacter(edge);
stat['edgeHex'] = {allSixDigit: !/#[0-9a-f]{7,}/i.test(JSON.stringify(edge)), loaded: true};
let mapErr = ''; try { toManifest(CHARACTERS.a, ADR0074, {think: 'cry'}); } catch (e) { mapErr = String((e as Error).message).slice(0, 80); }
stat['expressionMapRejectsDifferentMeaning'] = mapErr;
stat['expressionMapAcceptsSameMeaning'] = (() => { const x = toManifest(CHARACTERS.a, ADR0074, {sad: 'cry', angry: 'clench'}); loadCharacter(x); return Object.keys(x.expressions).length; })();
stat['normalizeIdempotent'] = JSON.stringify(normalize(normalize(CHARACTERS.a))) === JSON.stringify(normalize(CHARACTERS.a));
stat['ranges'] = Object.keys(RANGES).length;

// 9. the 4-panel sample with the two characters (renderInBrowser + comic())
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

// 10. swap compatibility (ADR 0079 D7): 1x2 with two stacked bubbles per panel, lines of 8..66 characters; built-in vs manga (no tuft, with a side tuft, mature)
const tuft: Character = {...structuredClone(CHARACTERS.a), id: 'mf-t', hair: {...CHARACTERS.a.hair, ahoge: 'right'}};
const mt = toManifest(tuft), mm = toManifest({...CHARACTERS.m, id: 'mf-mm'} as Character);
const chars = {'mf-a': a, 'mf-b': b, 'mf-t': mt, 'mf-mm': mm};
const base = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソ';
const swap: Record<string, {ok: number; fail: number}> = {builtin: {ok: 0, fail: 0}, manga: {ok: 0, fail: 0}, mangaTuft: {ok: 0, fail: 0}, mangaMature: {ok: 0, fail: 0}};
const regress: string[] = [];
for (const [layout, aspect] of [['1x2', '6:5'], ['2x2', '6:5'], ['1x3', '6:5']] as const) for (let len = 8; len <= 66; len += 4) {
  const lines = base.slice(0, len), res: Record<string, boolean> = {};
  for (const [label, cast] of [['builtin', {me: {name: '私', face: {hue: 200}}, col: {name: '同僚', face: {hue: 20}}}], ['manga', {me: {name: '私', asset: 'mf-a'}, col: {name: '同僚', asset: 'mf-b'}}], ['mangaTuft', {me: {name: '私', asset: 'mf-t'}, col: {name: '同僚', asset: 'mf-b'}}], ['mangaMature', {me: {name: '私', asset: 'mf-mm'}, col: {name: '同僚', asset: 'mf-b'}}]] as const) {
    const pan = (id: string, two: boolean) => ({id, stage: two ? [{who: 'me', at: 'left' as const, expression: 'neutral' as const}, {who: 'col', at: 'right' as const, expression: 'smile' as const}] : [{who: 'me', at: 'left' as const, expression: 'neutral' as const}], dialogue: two ? [{id: 'd1', who: 'me', kind: 'say' as const, tpl: lines}, {id: 'd2', who: 'col', kind: 'say' as const, tpl: lines}] : []});
    const count = layout === '1x2' ? 2 : layout === '1x3' ? 3 : 4;
    const ws: ComicWorksheet = {version: 1, title: 'Zone', layout, cast, panels: Array.from({length: count}, (_, i) => pan(`p${i}`, i === count - 1))};
    const r = await renderInBrowser(diagram({theme: 'blue', width: 500, legend: false}).add(comic(ws, {aspect, characters: chars})), {measure: hb});
    const ok = r.verdict.problems.filter((x: string) => !x.includes('text-budget')).length === 0;
    res[label] = ok; swap[label]![ok ? 'ok' : 'fail']++;
  }
  for (const k of ['manga', 'mangaTuft', 'mangaMature']) if (res['builtin'] && !res[k]) regress.push(`${k}@${layout}/${len}`);
}
stat['swapCompatibility'] = {layouts: '1x2, 2x2, 1x3 (6:5)', lengths: '8..66 step 4', ...swap, regressions: regress};
stat['topAnchors'] = {a: a.anchors.top, tuft: mt.anchors.top, b: b.anchors.top, mature: m.anchors.top, limit: 23};

fs.writeFileSync(path.join(dir, 'measurements.json'), `${JSON.stringify(stat, null, 2)}\n`);
console.log(JSON.stringify(stat, null, 2));
