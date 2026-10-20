// node --test test/   — ADR 0014 U1b: tops (and so the text inside a frame) are placed on the 4px grid, not rounded by the emitter.
// Only relations are asserted (never a font-dependent absolute): the text sits the same distance below its frame wherever the frame stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import {banner, box, caption, diagram, grid, group, renderDiagram, row, spacer, closeMeasurer} from '../lib/dsl.ts';
import {layoutDiagram} from '../lib/layout-measured.ts';
import type {LaidOutBand} from '../lib/types/index.ts';
import type {Band} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const OFFSETS = Array.from({length: 17}, (_, i) => i * 0.25); // 0 .. 4px above the first band, in quarter pixels

/** One of each frame-like part, under a spacer of `lead` px: the lead moves every one of them to a different fractional position. */
const sample = (lead: number, extra: Band[] = []) => diagram({theme: 'blue'}).add(
  spacer(lead),
  caption('見出し 1 行目\n2 行目', {bold: true}),
  box({title: 'タイトル', body: '本文が二行に\nなる箱'}),
  row([box({title: '左', body: '説明'}), box({title: '右', body: '説明\n二行'})]),
  group([box({title: '中', body: '説明'}), box({title: '中 2'})], {title: 'グループ'}),
  grid([box({title: 'a'}), box({title: 'b', body: 'x'}), box({title: 'c'}), box({title: 'd', body: 'x\ny'})], {cols: 2}),
  banner({headline: '帯の見出し', sub: '補足'}),
  ...extra,
);

type Placed = {y: number; type: string};
function tops(b: LaidOutBand, out: Placed[] = []): Placed[] {
  if ('y' in b && typeof b.y === 'number' && ['box', 'banner', 'caption', 'group'].includes(b.type)) out.push({y: b.y, type: b.type});
  if (b.type === 'row' || b.type === 'grid') for (const c of b.children) tops(c as unknown as LaidOutBand, out);
  return out;
}

test('every frame and caption top is already on the 4px grid after layout (the emitter snap is the identity)', async () => {
  for (const lead of OFFSETS) {
    const laid = await layoutDiagram(sample(lead));
    const ys = laid.laidOut.flatMap(b => tops(b));
    assert.ok(ys.length >= 12, `${ys.length} frames`);
    for (const p of ys) assert.equal(p.y % 4, 0, `${p.type} at y=${p.y} (lead ${lead})`);
  }
});

const rectsAndTexts = (svg: string) => ({
  rects: [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="8"/g)].map(m => ({y: Number(m[2]), h: Number(m[4])})),
  texts: [...svg.matchAll(/<text [^>]*?\by="([\d.]+)"[^>]*>([^<]*)</g)].map(m => ({y: Number(m[1]), s: m[2]})),
});

test('every drawn frame has its top and bottom on the grid, and its text keeps one distance from the top at every position', async () => {
  let first: number[] | undefined;
  for (const lead of OFFSETS) {
    const r = await renderDiagram(sample(lead), {name: 'v.svg', budget: 'cacheOnly'});
    const {rects, texts} = rectsAndTexts(r.svg);
    for (const f of rects) { assert.equal(f.y % 4, 0); assert.equal((f.y + f.h) % 4, 0); }
    // the first line of each box's title: its baseline minus the frame top that holds it
    const dist = texts.filter(t => ['タイトル', '左', '右', '中', '中 2', 'a', 'b', 'c', 'd', '帯の見出し'].includes(t.s!)).map(t => {
      const frame = [...rects].reverse().find(f => f.y <= t.y && t.y <= f.y + f.h);
      assert.ok(frame, `a frame holds "${t.s}"`);
      return t.y - (frame as {y: number}).y;
    });
    first ??= dist;
    // same text, same distance below its frame as with no lead at all: it does not swing by up to 4px with the position (ADR 0005 #8)
    assert.deepEqual(dist, first, `lead ${lead}`);
  }
});

test('ADR 0005 #8: a banner with padY 0 and a 16px headline passes the checks at every fractional position, with no padY detour', async () => {
  for (const lead of OFFSETS) {
    const d = diagram({theme: 'blue'}).add(spacer(lead), banner({headline: '二十五字前後の長い見出しの帯をここに置く', padY: 0}));
    const r = await renderDiagram(d, {name: 'b.svg', budget: 'cacheOnly'});
    assert.deepEqual(r.verdict.findings, [], `lead ${lead}`);
  }
});

test('structure does not depend on the position: elements, texts, ids and findings are the same at every fractional lead', async () => {
  const shape = (svg: string) => svg.replace(/<metadata[\s\S]*?<\/metadata>/, '').replace(/-?\d+(\.\d+)?/g, '#');
  let first: {shape: string; findings: string} | undefined;
  for (const lead of OFFSETS) {
    const r = await renderDiagram(sample(lead), {name: 'v.svg', budget: 'cacheOnly'});
    const now = {shape: shape(r.svg), findings: JSON.stringify(r.verdict.findings.map(f => f.rule).sort())};
    first ??= now;
    assert.equal(now.shape, first.shape, `lead ${lead}`);
    assert.equal(now.findings, first.findings, `lead ${lead}`);
  }
});
