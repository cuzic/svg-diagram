// node spikes/manga-face/run.ts [outdir] — manifests, loadCharacter, sizes, determinism, anchors, and the 4-panel comic() sample. See ADR 0079.
import fs from 'node:fs';
import path from 'node:path';
import {measureWithFonts} from '../../lib/font-metrics.ts';
import {loadCharacter} from '../../lib/comic/character.ts';
import {comic, diagram, renderInBrowser} from '../../lib/web.ts';
import type {ComicWorksheet} from '../../lib/types/comic.ts';
import {ADR0074, CHARACTERS, toManifest, faceFragment, CX, CY} from './face.ts';
import {sheet} from './gallery.ts';

const dir = process.argv[2] ?? path.join(import.meta.dirname, 'out');
fs.mkdirSync(dir, {recursive: true});
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');
const stat: Record<string, unknown> = {};

// 1. manifests (one character facing right as authored, one mirrored), accepted by loadCharacter
const a = toManifest(CHARACTERS.a), b = toManifest(CHARACTERS.b);
for (const m of [a, b]) loadCharacter(m);
fs.writeFileSync(path.join(dir, 'character-a.json'), `${JSON.stringify(a)}\n`);
stat['loadCharacter'] = 'accepted a and b';

// 2. size per expression (fragment bytes) and the manifest
stat['fragmentBytes'] = Object.fromEntries(ADR0074.map(e => [e, bytes(a.expressions[e]!)]));
stat['manifestBytes'] = {a: bytes(JSON.stringify(a)), b: bytes(JSON.stringify(b))};

// 3. determinism: build twice, and from a deep copy of the params, and compare byte for byte
const again = toManifest(structuredClone(CHARACTERS.a));
stat['deterministic'] = JSON.stringify(a) === JSON.stringify(again);
const g1 = sheet(ADR0074), g2 = sheet(ADR0074);
stat['galleryDeterministic'] = g1 === g2;
stat['galleryBytes'] = bytes(g1);

// 4. the 4-panel sample with the two characters
const sample: ComicWorksheet = {version: 1, title: '確認の会話', layout: '2x2', cast: {me: {name: '私', asset: 'mf-a'}, col: {name: '同僚', asset: 'mf-b'}}, panels: [
  {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression: 'smile'}], dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: 'ここが変更点です。'}]},
  {id: 'p2', stage: [{who: 'me', at: 'left', expression: 'surprise'}, {who: 'col', at: 'right', expression: 'think'}], dialogue: [{id: 'd1', who: 'col', kind: 'say', tpl: '要確認ですね。'}]},
  {id: 'p3', stage: [{who: 'me', at: 'left', expression: 'worry'}, {who: 'col', at: 'right', expression: 'angry'}], dialogue: [{id: 'd1', who: 'me', kind: 'think', tpl: '間に合うかな…'}]},
  {id: 'p4', stage: [{who: 'me', at: 'left', expression: 'laugh'}, {who: 'col', at: 'right', expression: 'sad'}], dialogue: [{id: 'd1', who: 'col', kind: 'say', tpl: 'あとで見ます。'}]},
]};
const hb = ({text, size}: {text: string; size: number}) => ({w: measureWithFonts(new Map([['k', {text, size, weight: 400, font: 'sans' as const}]])).get('k')!.w, h: size});
const render = () => renderInBrowser(diagram({theme: 'blue', title: sample.title, width: 780, legend: false}).add(comic(sample, {aspect: '6:5', characters: {'mf-a': a, 'mf-b': b}})), {measure: hb});
const r1 = await render(), r2 = await render();
fs.writeFileSync(path.join(dir, 'comic-sample.svg'), r1.svg);
stat['comicDeterministic'] = r1.svg === r2.svg;
stat['comicSvgBytes'] = bytes(r1.svg);
stat['comicVerdict'] = r1.verdict;
stat['comicHasFaces'] = {a: (r1.svg.match(/data-character="mf-a"/g) ?? []).length, b: (r1.svg.match(/data-character="mf-b"/g) ?? []).length};

// 5. anchors: the artwork's top y of every expression against the `top` anchor, measured in Chromium (getBBox of the fragment, ink width added)
const {chromium} = await import('playwright-chromium');
const br = await chromium.launch(), page = await br.newPage();
const probe = async (m: typeof a, e: string) => {
  await page.setContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.box.join(' ')}" width="300" height="400"><g id="g">${m.expressions[e as 'neutral']}</g></svg>`);
  return page.evaluate(() => { const bb = (document.getElementById('g') as unknown as SVGGraphicsElement).getBBox(); return {top: bb.y, bottom: bb.y + bb.height, left: bb.x, right: bb.x + bb.width}; });
};
const anchorRows: Record<string, unknown> = {};
for (const [k, m] of [['a', a], ['b', b]] as const) {
  const tops = await Promise.all(ADR0074.map(async e => (await probe(m, e)).top));
  const measuredTop = Math.min(...tops), inkTop = measuredTop - 2.3; // half of the 4.6 ink line
  anchorRows[k] = {declaredTop: m.anchors.top, measuredTop: Math.round(inkTop * 10) / 10, ok: m.anchors.top! <= inkTop + 0.5, box: m.box, bbox: await probe(m, 'neutral')};
}
await br.close();
stat['anchors'] = anchorRows;
stat['mouthAnchor'] = {a: a.anchors.mouth, b: b.anchors.mouth, headCircle: a.anchors.head, mirrorExpected: [300 - CX, CY + 70]};
stat['unused'] = faceFragment.length;
delete stat['unused'];

fs.writeFileSync(path.join(dir, 'measurements.json'), `${JSON.stringify(stat, null, 2)}\n`);
console.log(JSON.stringify(stat, null, 2));
