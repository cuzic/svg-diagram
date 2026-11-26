// Three bugs of the row layouts found in a deck (a follow-up to ADR 0074 実装メモ "row layouts and fontSize"): a stacked bubble wrapped at half a
// panel and ran past the panel's bottom, a too-narrow band was drawn silently in a deck, and the left person's shoulders left the panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {layoutComic, zoneOf} from '../lib/comic/layout.ts';
import {renderComicBand} from '../lib/comic/emit.ts';
import {comic} from '../lib/dsl-pure.ts';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import type {ComicDialogue, ComicLayoutName, ComicPanel, ComicWorksheet} from '../lib/types/comic.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const widthOf = (atom: string) => atom.length * 9;
const dlg = (id: string, who: string | undefined, kind: ComicDialogue['kind'], tpl: string): ComicDialogue => ({id, ...(who === undefined ? {} : {who}), kind, tpl});
// two people per panel, one narration and two lines (13 and 4 characters), as a 4x1 at fontSize 22
const crowded = (layout: ComicLayoutName = '4x1'): ComicWorksheet => ({version: 1, title: 'テスト', layout, cast: {me: {name: '私'}, col: {name: '同僚'}},
  panels: Array.from({length: 4}, (_, i): ComicPanel => ({id: `p${i + 1}`, stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression: 'smile'}],
    dialogue: [dlg('n0', undefined, 'narration', `第${i + 1}場`), dlg('d1', 'me', 'say', '明日は午前に書類を出します'), dlg('d2', 'col', 'think', '了解です')]}))});

test('a bubble stacked under another uses the panel\'s width, not half of it, and stays inside the band over the heads', () => {
  const l = layoutComic(comic(crowded(), {fontSize: 22}), 0, 0, 1212, widthOf);
  assert.deepEqual(l.findings.filter(f => f.severity === 'problem'), []);
  const zone = zoneOf(l.panels[0]!.h, 22);
  for (const b of l.bubbles) {
    const p = l.panels.find(q => q.id === b.panel)!;
    assert.ok(b.y + b.h <= p.y + zone.bottom, `${b.id} ends at ${b.y + b.h - p.y}, the zone at ${zone.bottom}`);
    assert.ok(b.x >= p.x && b.x + b.w <= p.x + p.w, b.id);
  }
  const say = l.bubbles.find(b => b.id === 'p1.d1')!;
  assert.ok(say.w >= 8 * 22, `the stacked line is ${say.w}px wide`); // it was 3 characters wide
});

test('what cannot fit at any wrap is reported, never drawn past the panel without a problem', () => {
  let long = crowded();
  long = {...long, panels: long.panels.map(pn => ({...pn, dialogue: [...pn.dialogue, dlg('d3', 'me', 'say', 'もう少しだけ長い台詞を足してみます'), dlg('d4', 'col', 'say', 'さらにもう一つ足してみます')]}))};
  const l = layoutComic(comic(long, {fontSize: 22}), 0, 0, 1212, widthOf);
  const p = l.panels[0]!, zone = zoneOf(p.h, 22);
  assert.ok(l.bubbles.some(b => b.panel === 'p1' && b.y + b.h > p.y + zone.bottom));
  assert.ok(l.findings.some(f => f.severity === 'problem' && (f.rule === 'comic-bubble-zone' || f.rule === 'comic-text-budget')));
});

test('when no wrap fits, the set with the least overflow is kept (not the 7-line, 2-character-wide stack), and the problem is reported', () => {
  const long = {...crowded(), panels: crowded().panels.map(pn => ({...pn, dialogue: [dlg('n0', undefined, 'narration', '第1場 朝の様子'), dlg('d1', 'me', 'say', '明日は午前に書類を出します'), dlg('d2', 'col', 'think', '私は後から整えよう')]}))};
  const l = layoutComic(comic(long, {fontSize: 22}), 0, 0, 940, widthOf); // 204px panels: nothing fits
  assert.ok(l.findings.some(f => f.severity === 'problem' && f.rule === 'comic-bubble-zone'));
  const say = l.bubbles.find(b => b.id === 'p1.d1')!;
  assert.ok(say.lines.length <= 3 && say.w >= 6 * 22, `${say.lines.length} lines, ${say.w}px`);
});

test('a person at the panel\'s left edge in a row is clipped to the panel (the shoulders are wider than the head\'s distance to the side)', () => {
  const svg = renderComicBand(layoutComic(comic(crowded(), {fontSize: 22}), 0, 0, 940, widthOf)); // 204px panels
  const faces = [...svg.matchAll(/<g data-head="(p\d)\.(me|col)"([^>]*)>/g)];
  assert.equal(faces.length, 8);
  for (const m of faces) assert.match(m[3]!, /clip-path="url\(#pc-p\d-in\)"/, `${m[1]}.${m[2]}`);
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'every id is unique (two clipped people in one panel share one clip)');
  // the clip is the panel's inner edge: half a frame stroke (1.5px) in from the panel rectangle
  const p1 = layoutComic(comic(crowded(), {fontSize: 22}), 0, 0, 940, widthOf).panels[0]!;
  assert.ok(svg.includes(`<clipPath id="pc-p1-in"><rect x="${p1.x + 1.5}" y="${p1.y + 1.5}" width="${p1.w - 3}" height="${p1.h - 3}"/>`));
  // in a column the shoulders are inside the panel: the output is as before
  const col = renderComicBand(layoutComic(comic({...crowded('1x4'), panels: crowded('1x4').panels.slice(0, 4)}, {}), 0, 0, 0, widthOf));
  assert.doesNotMatch(col, /<g data-head="[^"]*" clip-path/);
});

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comic-row-deck-'));
test.after(() => fs.rmSync(dir, {recursive: true, force: true}));

test('a deck reports the problems of a .ts figure (a 4x1 comic on a 800px diagram)', async () => {
  const fig = path.join(dir, 'narrow.diagram.ts');
  fs.writeFileSync(fig, `import {comic, diagram} from 'svg-diagram';
export default function define() {
  return diagram({theme: 'blue', title: 'n', showTitle: false, legend: false, width: 800}).add(comic(${JSON.stringify(crowded())}, {fontSize: 18}));
}\n`);
  const file = path.join(dir, 'deck.json');
  fs.writeFileSync(file, JSON.stringify({slides: [{title: 'A', figure: 'narrow.diagram.ts'}]}));
  const r = loadDeck(file);
  assert.ok(r.ok);
  const out = await renderDeck(r.loaded, cfg);
  assert.ok([...out.errors, ...out.warnings].some(t => t.includes('comic-band-narrow') && t.includes('slides[0]')), JSON.stringify([out.errors, out.warnings]));
});
