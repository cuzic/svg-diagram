// B5: a timeline lane name may be 30 characters; the lane column wraps it and leaves the axis most of the width.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {loadDeck} from '../lib/deck-load.ts';
import type {LaidOutTimeline} from '../lib/dsl.ts';
import {specToDiagram} from '../lib/spec.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const cfg = {measure: 'font' as const, fonts: JA_FONTS};
configureMeasure(cfg);
test.after(() => closeMeasurer());

const JA = '第一部門の初期検証と品質確認の準備作業全般を担当する班の活動', LATIN = 'Platform reliability and release tooling';
const NAMES = [JA.slice(0, 30), LATIN.slice(0, 30)];
const fig = (lanes: string[]) => ({version: 1, title: 't', parts: [{type: 'timeline', unit: 'ms', from: 0, to: 700, lanes,
  events: [{at: 100, label: 'start', lane: lanes[0]}, {at: 400, label: 'done', lane: lanes[1]}],
  spans: [{from: 50, to: 600, label: 'work', lane: lanes[1]}]}]});

test('timeline lane names of 30 characters are accepted by the spec', () => {
  assert.equal(NAMES[0]!.length, 30); assert.equal(NAMES[1]!.length, 30);
  assert.doesNotThrow(() => specToDiagram(fig(NAMES)));
});

test('timeline lane names of 31 characters are still refused', () => {
  assert.throws(() => specToDiagram(fig(['x'.repeat(31), 'y'])));
});

test('30-character Japanese and Latin lane names draw on a slide, wrapped, leaving the axis wide', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-lane-')), file = path.join(dir, 'deck.json');
  fs.writeFileSync(file, JSON.stringify({slides: [{title: 'S', figure: fig(NAMES)}]}));
  const r = loadDeck(file);
  assert.ok(r.ok);
  const out = await renderDeck(r.loaded, cfg);
  fs.rmSync(dir, {recursive: true, force: true});
  assert.deepEqual(out.errors, []);
  const svg = String((out.slides[0] as {svg?: string}).svg ?? '');
  assert.ok(svg.length > 0);
  // the name is split over lines: no single text element holds a whole 30-character name
  assert.ok(!svg.includes(`>${NAMES[0]}<`) && !svg.includes(`>${NAMES[1]}<`));
});

test('the lane column is capped: the axis keeps at least 60% of the figure and the long Japanese name wraps', async () => {
  const r = await checkDiagram(specToDiagram(fig(NAMES)));
  const t = r.laidOut.laidOut.find((x): x is LaidOutTimeline => x.type === 'timeline')!;
  assert.ok(t.axis.x2 - t.axis.x1 >= 0.6 * t.w, `axis ${t.axis.x2 - t.axis.x1} of ${t.w}`);
  const lines = t.texts.filter(x => x.x === t.x + 12).map(x => x.text);
  assert.equal(lines.join('').replace(/\s/g, ''), NAMES.join('').replace(/\s/g, ''));
  assert.ok(lines.length >= 3, `lines: ${lines.join('|')}`);
});

// M1: the lane wrapper is the library's own (kinsoku, whole katakana / kanji words)
const laneLines = async (name: string, width?: number): Promise<string[]> => {
  const part = {type: 'timeline', unit: 'ms', from: 0, to: 700, lanes: [name, 'B'], events: [{at: 100, label: 'start', lane: name}]};
  const d = specToDiagram({version: 1, title: 't', ...(width ? {width} : {}), parts: [part]});
  const t = (await checkDiagram(d)).laidOut.laidOut.find((x): x is LaidOutTimeline => x.type === 'timeline')!;
  return t.texts.filter(x => x.x === t.x + 12 && x.bold).map(x => x.text).filter(x => x !== 'B');
};

test('lane names: a katakana word stays whole, no line starts with a small kana, a long mark or a middle dot', async () => {
  for (const [name, width] of [['デジタルトランスフォーメーション推進プロジェクト室', undefined], ['デジタルトランスフォーメーション推進プロジェクト室', 560], ['カスタマーサクセス・オペレーション推進グループ', 560]] as const) {
    const lines = await laneLines(name, width);
    assert.ok(lines.length >= 2, name);
    assert.equal(lines.join(''), name);
    for (const l of lines) assert.ok(!/^[ォーァィゥェ・]/.test(l), `a line starts with a forbidden character: ${l}`);
  }
});

test('lane names: a katakana word that fits the column stays whole', async () => {
  const lines = await laneLines('基盤整備のトランスフォーメーション推進チーム');
  assert.ok(lines.length >= 2 && lines.some(l => l.includes('トランスフォーメーション')), lines.join('|'));
});

test('lane names: a kanji compound is not split where it can be avoided', async () => {
  const lines = await laneLines('デジタルトランスフォーメーション推進プロジェクト室');
  assert.ok(!lines.some((l, i) => l.endsWith('推') && lines[i + 1]?.startsWith('進')), lines.join('|'));
});

test('a lane name split mid-word: the advice does not offer keepWords (it has no effect on lanes)', async () => {
  const lanes = ['デジタルトランスフォーメーション推進プロジェクト室', '品質'];
  const r = await checkDiagram(specToDiagram({...fig(lanes), width: 560} as never));
  const f = r.verdict.findings.find(x => x.rule === 'text-mid-word-break');
  assert.ok(f, JSON.stringify(r.verdict.findings.map(x => x.rule)));
  assert.ok(!/keepWords/.test(f.message), f.message);
  assert.match(f.message, /timeline/);
});
