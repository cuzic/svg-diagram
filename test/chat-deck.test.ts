// ADR 0074 U5, PR #473 round 2: the chat through the real measuring path (the first pass measures every word, character and name) and into a deck.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {loadDeck} from '../lib/deck-load.ts';
import {chat, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import type {ChatOpts, ChatSheet} from '../lib/types/chat.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

installResolveHook();
const cfg = {measure: 'font', fonts: JA_FONTS} as const;
configureMeasure(cfg);
test.after(() => closeMeasurer());

const URL_LINE = '参考資料は https://example.com/very/long/path/to/the/meeting-minutes-2026-11-25-final-version.pdf にあります。';
const sheet = (name: string, tpl = 'こんにちは。'): ChatSheet => ({version: 1, title: '相談', cast: {me: {name: '私'}, ai: {name}}, dialogue: [
  {id: 'ask', who: 'me', kind: 'say', tpl: URL_LINE}, {id: 'ok', who: 'ai', kind: 'say', tpl}]});
const fig = (s: ChatSheet, opts: ChatOpts = {}) => diagram({theme: 'blue', title: '相談', width: Math.max(520, (opts.width ?? 480) + 40), legend: false}).add(chat(s, opts));

test('a long URL is broken per character through the real measuring path (check and build), staying inside the column', async () => {
  const d = fig(sheet('案内係'));
  const {verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const r = await renderDiagram(fig(sheet('案内係'), {width: 800, fontSize: 24}), {name: 'c', budget: 'cacheOnly'});
  assert.deepEqual(r.xml, []);
  assert.match(r.svg, /data-chat="screen"/);
});

test('a speaker name wider than the room beside the face is a problem (chat-name-wide), never drawn past the frame silently', async () => {
  const name = 'カスタマーサポート担当の生成AIアシスタント試験版';
  const {verdict} = await checkDiagram(fig(sheet(name), {fontSize: 28}));
  assert.ok(verdict.problems.some(p => p.includes('chat-name-wide')), verdict.problems.join('\n'));
  assert.deepEqual((await checkDiagram(fig(sheet('案内係'), {fontSize: 28}))).verdict.problems, []);
  assert.deepEqual((await checkDiagram(fig(sheet(name), {fontSize: 28, width: 880}))).verdict.problems, [], 'a wider band leaves room');
});

test('a chat with the message box, a URL and a long name goes through renderDeck (no dominant-baseline text)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-deck-'));
  try {
    fs.writeFileSync(path.join(dir, 'fig.ts'), `import {chat, diagram} from 'svg-diagram';\nexport default () => diagram({theme: 'blue', title: '相談', width: 520, legend: false}).add(chat(${JSON.stringify(sheet('案内係', '承知しました。下書きを作ります。'))}, {input: '指示を入力'}));\n`);
    fs.writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({slides: [{title: 'チャット', figure: 'fig.ts'}]}));
    const got = loadDeck(path.join(dir, 'deck.json'));
    assert.ok(got.ok, JSON.stringify(got));
    const r = await renderDeck(got.loaded, cfg);
    assert.deepEqual(r.errors, []);
    assert.match(r.slides[0]?.svg ?? '', /指示を入力/);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('the examples draw through renderDeck', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-deck-'));
  try {
    for (const f of ['chat-draft.ts', 'chat-sheet.ts']) fs.copyFileSync(new URL(`../examples/${f}`, import.meta.url), path.join(dir, f));
    fs.writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({slides: [{title: 'A', figure: 'chat-draft.ts'}, {title: 'B', figure: 'chat-sheet.ts'}]}));
    const got = loadDeck(path.join(dir, 'deck.json'));
    assert.ok(got.ok, JSON.stringify(got));
    const r = await renderDeck(got.loaded, cfg);
    assert.deepEqual(r.errors, []);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
