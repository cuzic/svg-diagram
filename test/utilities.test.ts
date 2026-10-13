// Pure helpers typed in the TypeScript migration: tokens (luminance / WCAG), wrap (kinsoku), svg-diff, docs-check,
// config, and the rules helpers. No browser needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {luminance, blendLuminance, bestTextColor, relativeLuminance, wcagRatio, PALETTE, THEMES, ALLOWED_COLORS, MIN_FONT_SIZE, ROLES, SHADES, EMOJI_RE} from '../lib/tokens.ts';
import {wrapAtoms, wrapText} from '../lib/wrap.ts';
import {splitAtoms} from '../lib/measure.ts';
import {explainChange} from '../lib/svg-diff.ts';
import {scanMarkdown, parseItem, compareNotes, notesOf} from '../lib/docs-check.ts';
import {loadConfig, applyConfig} from '../lib/config.ts';
import {edgeStats, walkBands, usedNotation, legendKeys, diagramTitle, diagramDesc} from '../lib/rules.ts';
import {diagram, box, banner, caption, group, row, grid, swimlane, table, sequence, wireframe, wf, legend} from '../lib/dsl.ts';
import type {LaidOutConnect, Point, Band} from '../lib/types.ts';

// ---- tokens --------------------------------------------------------------------------------------------
test('luminance: BT.601 weights; black 0, white 255, pure channels', () => {
  assert.equal(luminance('#000000'), 0);
  assert.equal(Math.round(luminance('#ffffff')), 255);
  assert.ok(Math.abs(luminance('#ff0000') - 0.299 * 255) < 1e-9);
  assert.ok(Math.abs(luminance('#00ff00') - 0.587 * 255) < 1e-9);
  assert.ok(Math.abs(luminance('#0000ff') - 0.114 * 255) < 1e-9);
});

test('blendLuminance: alpha 0 is the base, alpha 1 is the overlay, in between is linear', () => {
  const [base, over] = ['#ffffff', '#1d5fa8'];
  assert.equal(blendLuminance(base, over, 0), luminance(base));
  assert.equal(blendLuminance(base, over, 1), luminance(over));
  const mid = blendLuminance(base, over, 0.5);
  assert.ok(Math.abs(mid - (luminance(base) + luminance(over)) / 2) < 1e-9);
});

test('bestTextColor: white on dark backgrounds, PALETTE.text on light ones, and every theme accent gets a readable one', () => {
  assert.equal(bestTextColor(0), '#ffffff');
  assert.equal(bestTextColor(255), PALETTE.text);
  assert.equal(bestTextColor(luminance(PALETTE.text)), '#ffffff');
  for (const t of THEMES) {
    const accent = (PALETTE as unknown as Record<string, {accent: string}>)[t].accent;
    const fg = bestTextColor(luminance(accent));
    assert.ok(wcagRatio(fg, accent) >= 3, `${t}: ${fg} on ${accent}`);
  }
  // fully-opaque to faint layers of a pyramid: some readable colour at every SHADES step
  for (const a of SHADES) {
    const bg = blendLuminance('#ffffff', PALETTE.blue.accent, a);
    assert.ok(['#ffffff', PALETTE.text].includes(bestTextColor(bg)));
  }
});

test('relativeLuminance / wcagRatio: known values, symmetric, within 1..21', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  assert.ok(Math.abs(relativeLuminance('#ffffff') - 1) < 1e-9);
  assert.ok(Math.abs(wcagRatio('#000000', '#ffffff') - 21) < 1e-9);
  assert.equal(wcagRatio('#ffffff', '#000000'), wcagRatio('#000000', '#ffffff'));
  // the 0.03928 knee of the sRGB curve: a very dark grey is linear
  assert.ok(Math.abs(relativeLuminance('#0a0a0a') - (10 / 255 / 12.92)) < 1e-9);
  // #767676 on white is the well-known ~4.54:1 AA boundary
  const r = wcagRatio('#767676', '#ffffff');
  assert.ok(r > 4.5 && r < 4.6, String(r));
});

test('tokens: every palette colour is allowed, the text/background pair passes AA, roles never go below the floor', () => {
  for (const c of [PALETTE.bg, PALETTE.text, PALETTE.muted, PALETTE.border, PALETTE.code, PALETTE.danger]) assert.ok(ALLOWED_COLORS.has(c), c);
  assert.ok(wcagRatio(PALETTE.text, PALETTE.bg) >= 7);
  assert.ok(Object.values(ROLES).every(s => s >= MIN_FONT_SIZE));
  assert.equal(MIN_FONT_SIZE, 14);
  assert.deepEqual([...THEMES].sort(), ['1', '2', 'amber', 'blue', 'teal']);
  assert.ok(EMOJI_RE.test('🚀') && !EMOJI_RE.test('✓'));
});

// ---- wrap ----------------------------------------------------------------------------------------------
const w1 = (a: string) => [...a].length; // one unit per character
test('wrapAtoms: breaks at the width, honours explicit \\n, drops leading whitespace', () => {
  assert.deepEqual(wrapText('あいうえおか', {maxWidth: 3, atomWidth: w1}), ['あいう', 'えおか']);
  assert.deepEqual(wrapText('ab\ncd', {maxWidth: 10, atomWidth: w1}), ['ab', 'cd']);
  assert.deepEqual(wrapText('hello world foo', {maxWidth: 11, atomWidth: w1}), ['hello world', 'foo']);
  assert.deepEqual(wrapText('', {maxWidth: 5, atomWidth: w1}), []);
  assert.deepEqual(wrapText('a    b', {maxWidth: 3, atomWidth: w1}), ['a', 'b'], 'whitespace that does not fit is dropped, not carried to the next line');
  assert.deepEqual(wrapAtoms(['長い単語', 'x'], {maxWidth: 2, atomWidth: w1}), ['長い単語', 'x'], 'an atom wider than the line stays whole on its own line');
});

test('wrapAtoms kinsoku: closing punctuation never starts a line, opening brackets never end one', () => {
  const lines = wrapText('あいう。えお', {maxWidth: 3, atomWidth: w1});
  assert.deepEqual(lines, ['あいう。', 'えお']);
  assert.ok(lines.every(l => !'、。」）'.includes(l[0])));
  const open = wrapText('あい「うえ」', {maxWidth: 3, atomWidth: w1});
  assert.ok(open.every(l => !'「'.includes(l.at(-1)!)), JSON.stringify(open));
  assert.equal(open.join(''), 'あい「うえ」');
  assert.deepEqual(wrapText('あいうーえ', {maxWidth: 3, atomWidth: w1})[1][0] !== 'ー', true, 'the long vowel mark does not start a line');
  assert.deepEqual(splitAtoms('ab 日本c'), ['ab', ' ', '日', '本', 'c']);
});

// ---- svg-diff ------------------------------------------------------------------------------------------
const svg = (meta: string, body: string, size = 'width="100" height="50"') => `<svg xmlns="http://www.w3.org/2000/svg" ${size}><metadata id="svg-diagram">${meta}</metadata>${body}</svg>`;
test('explainChange: canvas size, removed text, text added, multiple moved texts, and metadata plus content', () => {
  const t = (x: number, s: string) => `<text x="${x}" y="20" font-size="14">${s}</text>`;
  const base = svg('{"v":1}', t(4, 'あ') + t(40, 'い') + t(80, 'う') + t(120, 'え'));
  const resized = explainChange(base, svg('{"v":1}', t(4, 'あ') + t(40, 'い') + t(80, 'う') + t(120, 'え'), 'width="200" height="50"'));
  assert.equal(resized.visual, true);
  assert.match(resized.lines.join(), /キャンバスの大きさ: 100x50 → 200x50/);

  const movedMany = explainChange(base, svg('{"v":1}', t(5, 'あ') + t(41, 'い') + t(81, 'う') + t(121, 'え')));
  assert.match(movedMany.lines.join(), /文字の移動: 4 件.*ほか/);

  const changedText = explainChange(base, svg('{"v":1}', t(4, 'あ') + t(40, 'い') + t(80, 'う')));
  assert.match(changedText.lines.join(), /文字の増減: \+0 \/ -1（「え」）/);
  assert.equal(changedText.identical, false);

  const both = explainChange(base, svg('{"v":2}', t(4, 'あ') + t(40, 'い') + t(80, 'う') + t(120, 'お')));
  assert.match(both.lines.join(), /メタデータも変更/);
  assert.equal(both.visual, true);
  assert.equal(explainChange('', '').identical, true);
});

// ---- docs-check ----------------------------------------------------------------------------------------
test('scanMarkdown: several images on one line, a list ended by a heading or another image, indented continuation lines, non-svg ignored', () => {
  const two = scanMarkdown('![a](x.svg) text ![b](y.svg)\n');
  assert.deepEqual(two.map(f => [f.line, f.alt, f.ref]), [[1, 'a', 'x.svg'], [1, 'b', 'y.svg']]);
  assert.deepEqual(scanMarkdown('![p](x.png)\n![u](https://e.com/a.svg)').map(f => f.ref), ['https://e.com/a.svg']);

  const md = ['![a](a.svg)', '', '1. **一**：甲', '   続きの行', '2. **二**：乙', '', '3. **三**：丙', '', '## 見出し', '1. **別**：無関係'].join('\n');
  const [fig] = scanMarkdown(md);
  assert.deepEqual(fig.items.map(i => [i.n, i.title]), [[1, '一'], [2, '二'], [3, '三']], 'a blank line between items does not end the list; a heading does');

  const md2 = ['![a](a.svg)', '1. **一**：甲', '![b](b.svg)', '1. **二**：乙'].join('\n');
  const [f1, f2] = scanMarkdown(md2);
  assert.deepEqual([f1.items.length, f2.items.length], [1, 1], 'the next image ends the first list');
  assert.equal(f1.items[0].title, '一');

  const para = scanMarkdown(['![a](a.svg)', '', '1. **一**：甲', '', '普通の段落', '1. **関係ない**：x'].join('\n'))[0];
  assert.equal(para.items.length, 1, 'a paragraph after a blank line ends the list');
  assert.deepEqual(scanMarkdown('no images here'), []);
  assert.equal(scanMarkdown('![x](a.svg)\n1. text')[0].items[0].n, 1, 'a list without bold keeps the whole text');
});

test('parseItem: ASCII or full-width colon, missing bold, extra spaces, colon inside the text, empty text', () => {
  assert.deepEqual(parseItem('**題**：本文'), {title: '題', text: '本文'});
  assert.deepEqual(parseItem('**題** : 本文'), {title: '題', text: '本文'});
  assert.deepEqual(parseItem('**題**:本文: さらに'), {title: '題', text: '本文: さらに'});
  assert.deepEqual(parseItem('**題**：'), {title: '題', text: ''});
  assert.deepEqual(parseItem('題なし：本文'), {title: '', text: '題なし：本文'});
  assert.deepEqual(parseItem('**未閉じ：本文'), {title: '', text: '**未閉じ：本文'});
});

test('compareNotes: string notes, explicit n, extra items in the page, and notesOf nests into groups', () => {
  assert.deepEqual(compareNotes([{n: 1, title: '', text: '説明'}], ['説明'], 'f'), []);
  const extra = compareNotes([{n: 1, title: '', text: 'a'}, {n: 2, title: '', text: 'b'}], ['a'], 'f');
  assert.equal(extra.length, 1);
  assert.match(extra[0].message, /文書 2 件 \/ 図 1 件/);
  const byN = compareNotes([{n: 3, title: 'T', text: 'x'}], [{n: 3, title: 'T', text: 'x'}], 'f');
  assert.deepEqual(byN, [], 'explicit n is matched by number, not position');
  assert.match(compareNotes([{n: 1, title: 'T', text: 'x'}], [{n: 2, title: 'T', text: 'x'}], 'f').map(f => f.message).join(), /図の注釈 2「T」が文書にない/);

  const w1 = wireframe(wf.text('x'), {notes: ['n1']}), w2 = wireframe(wf.text('y'), {notes: [{title: 't', text: 'n2'}]}), w3 = wireframe(wf.text('z'));
  const sets = notesOf([w1, group([w2, w3]), box({title: 'x'})]);
  assert.equal(sets.length, 2);
  assert.deepEqual(sets[0], ['n1']);
  assert.deepEqual(notesOf([]), []);
});

// ---- config --------------------------------------------------------------------------------------------
test('loadConfig: the nearest file wins, _file records it, invalid JSON throws with the path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cfgu-'));
  const inner = path.join(root, 'a', 'b');
  fs.mkdirSync(inner, {recursive: true});
  fs.writeFileSync(path.join(root, '.svg-diagram.json'), JSON.stringify({maxWidth: 111}));
  fs.writeFileSync(path.join(root, 'a', '.svg-diagram.json'), JSON.stringify({maxWidth: 222, accept: {density: 'x'}}));
  const cfg = loadConfig(inner);
  assert.equal(cfg.maxWidth, 222, 'a nearer config shadows the farther one (no merging)');
  assert.equal(cfg._file, path.join(root, 'a', '.svg-diagram.json'));
  assert.equal(loadConfig(root).maxWidth, 111);
  assert.equal(loadConfig(path.relative(process.cwd(), inner)).maxWidth, 222, 'a relative start directory works');

  fs.writeFileSync(path.join(root, 'a', '.svg-diagram.json'), '{ not json');
  assert.throws(() => loadConfig(inner), (e: Error) => e.message.startsWith(path.join(root, 'a', '.svg-diagram.json') + ':') && /JSON/.test(e.message));
  fs.writeFileSync(path.join(root, 'a', '.svg-diagram.json'), '');
  assert.throws(() => loadConfig(inner), /\.svg-diagram\.json/);
});

test('applyConfig: project accept merges under the diagram own; maxWidth fills only when unset; no config is a no-op', () => {
  const d = applyConfig({accept: {density: 'own'}, maxWidth: undefined} as never, {accept: {density: 'proj', 'doc-width': 'proj'}, maxWidth: 900}) as {accept: Record<string, string>; maxWidth: number};
  assert.deepEqual(d.accept, {density: 'own', 'doc-width': 'proj'});
  assert.equal(d.maxWidth, 900);
  const own = applyConfig({maxWidth: 1200} as never, {maxWidth: 900}) as {maxWidth: number};
  assert.equal(own.maxWidth, 1200);
  const none = applyConfig({} as never, {}) as {accept: object; maxWidth?: number};
  assert.deepEqual(none.accept, {});
  assert.equal(none.maxWidth, undefined);
});

// ---- rules helpers -------------------------------------------------------------------------------------
const seg = (pts: [number, number][], fromId: string, toId: string) => ({points: pts.map(([x, y]): Point => ({x, y})), fromId, toId}) as unknown as LaidOutConnect;
test('edgeStats: elbow paths, collinear overlaps (horizontal and vertical), touching ends and no connectors', () => {
  assert.deepEqual(edgeStats([]), {crossings: 0, overlaps: 0});
  const h = seg([[0, 50], [100, 50]], 'a', 'b');
  // a T junction (vertical ends exactly on the horizontal line) is not a crossing
  assert.equal(edgeStats([h, seg([[50, 50], [50, 100]], 'c', 'd')]).crossings, 0);
  // a polyline with two legs crossing a horizontal once
  assert.equal(edgeStats([h, seg([[30, 0], [30, 20], [70, 20], [70, 90]], 'c', 'd')]).crossings, 1);
  // overlapping horizontals of different boxes
  assert.deepEqual(edgeStats([h, seg([[20, 51], [90, 51]], 'c', 'd')]), {crossings: 0, overlaps: 1});
  // short overlap (<= 12px) is ignored
  assert.equal(edgeStats([h, seg([[95, 51], [140, 51]], 'c', 'd')]).overlaps, 0);
  // vertical overlaps
  const v = seg([[10, 0], [10, 100]], 'a', 'b');
  assert.equal(edgeStats([v, seg([[11, 20], [11, 80]], 'c', 'd')]).overlaps, 1);
  assert.equal(edgeStats([v, seg([[11, 20], [11, 80]], 'b', 'd')]).overlaps, 0, 'sharing an endpoint box is not an overlap');
  // one connector never counts against itself
  assert.deepEqual(edgeStats([seg([[0, 0], [50, 0], [50, 50], [0, 50], [0, 0]], 'a', 'a')]), {crossings: 0, overlaps: 0});
});

test('walkBands / usedNotation / legendKeys / diagramTitle / diagramDesc over nested bands', () => {
  const sw = swimlane([{id: 'l', label: 'レーン'}], [{id: 's', lane: 'l', title: '手順', tone: 'new'}]);
  const bands: Band[] = [group([row([box({id: 'a', title: 'a', tone: 'danger'})]), grid([box({id: 'b', title: 'b'})], {cols: 1})], {title: '枠'}), ...sw];
  assert.ok(usedNotation(bands).has('tone:danger'));
  assert.ok(usedNotation(bands).has('tone:new'), 'swimlane steps count');
  assert.equal(legendKeys([legend([{tone: 'new', label: 'N'}, {line: 'dashed', label: 'D'}])]).size, 2);
  const d = diagram({theme: 'blue'});
  d.add(...bands);
  assert.equal(diagramTitle(d), '枠', 'falls back to a group title when there is no caption / banner');
  assert.match(diagramDesc(d), /レーン: レーン。手順: 手順/);
  const d2 = diagram({theme: 'blue'});
  d2.add(banner({headline: '見出し\n二行'}), table([{label: '列1'}, {label: '列2'}], [], {title: '表名'}), sequence([{id: 'u', label: '利用者'}], []));
  assert.equal(diagramTitle(d2), '見出し 二行');
  assert.match(diagramDesc(d2), /表「表名」: 列 列1、列2。参加者: 利用者/);
  const d3 = diagram({theme: 'blue', title: 'T', desc: 'D'});
  assert.deepEqual([diagramTitle(d3), diagramDesc(d3)], ['T', 'D']);
  const many = diagram({theme: 'blue'});
  many.add(...Array.from({length: 18}, (_, i) => box({title: `b${i}`})));
  assert.match(diagramDesc(many), /ほか$/);
  assert.equal(diagramDesc(diagram({theme: 'blue'})), '');
  assert.equal(diagramTitle(diagram({theme: 'blue'})), '');
  assert.ok(caption('x'));
});

test('applyConfig: project legend fills only when the diagram has none; legendLabels merge under the diagram own', () => {
  const cfg = {legend: false as const, legendLabels: {'tone:accent': '注意', 'tone:solid': '結論'}};
  const d = applyConfig({} as never, cfg) as {legend?: unknown; legendLabels: Record<string, string>};
  assert.equal(d.legend, false);
  assert.deepEqual(d.legendLabels, {'tone:accent': '注意', 'tone:solid': '結論'});
  const own = applyConfig({legend: 'auto', legendLabels: {'tone:accent': '要点'}} as never, cfg) as {legend?: unknown; legendLabels: Record<string, string>};
  assert.equal(own.legend, 'auto');
  assert.deepEqual(own.legendLabels, {'tone:accent': '要点', 'tone:solid': '結論'});
  assert.equal((applyConfig({} as never, {}) as {legend?: unknown}).legend, undefined);
});
