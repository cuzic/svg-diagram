// Documents <-> diagrams, SVG change explanations, project config, output formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {scanMarkdown, parseItem, compareNotes, formatNotes, formatMap, checkFigures, chapterOf, globToRegExp, matchesAny} from '../lib/docs-check.ts';
import {explainChange} from '../lib/svg-diff.ts';
import {loadConfig, applyConfig} from '../lib/config.ts';
import type {DiagramData} from '../lib/types.ts';

const CHECK = new URL('../check-diagram.ts', import.meta.url).pathname;

test('scanMarkdown: finds figures, their alt text and the numbered list that follows', () => {
  const md = ['# T', '', '![概要](../a/x.svg)', '', '図中の番号に対応する注釈：', '', '1. **題名一**：本文一', '2. **題名二**：本文二', '', '次の段落', '![](y.svg)', '- 箇条書き'].join('\n');
  const [a, b] = scanMarkdown(md);
  assert.deepEqual([a.line, a.alt, a.ref], [3, '概要', '../a/x.svg']);
  assert.deepEqual(a.items, [{n: 1, title: '題名一', text: '本文一'}, {n: 2, title: '題名二', text: '本文二'}]);
  assert.deepEqual([b.alt, b.items.length], ['', 0]);
  assert.deepEqual(parseItem('**A**: b'), {title: 'A', text: 'b'});
});

test('compareNotes: a figure note that is missing, reworded or renamed in the page is reported', () => {
  const notes = [{title: '検索', text: '品名で絞る。'}, {title: '一覧', text: '結果を出す。'}];
  const same = [{n: 1, title: '検索', text: '品名で絞る。'}, {n: 2, title: '一覧', text: '結果を出す。'}];
  assert.deepEqual(compareNotes(same, notes, 'f'), []);
  assert.deepEqual(compareNotes(same.map(i => ({...i, text: i.text.replace('。', ' 。')})), notes, 'f'), [], 'spacing does not matter');
  assert.match(compareNotes([same[0], {...same[1], text: '違う本文。'}], notes, 'f')[0].message, /注釈 2「一覧」の本文が違う/);
  assert.match(compareNotes([same[0], {...same[1], title: '別名'}], notes, 'f')[0].message, /題名が違う/);
  assert.match(compareNotes([same[0]], notes, 'f').map(f => f.message).join(), /数が違う/);
  assert.equal(compareNotes([], notes, 'f')[0].rule, 'doc-notes-missing');
});

test('explainChange: metadata-only and invisible-backing changes are not visual; moved text and new shapes are', () => {
  const svg = (meta: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><metadata id="svg-diagram">${meta}</metadata>${body}</svg>`;
  const base = svg('{"v":"0.2.0"}', '<rect x="0" y="0" width="10" height="10" fill="#fff"/><text x="4" y="20" font-size="14">文字</text>');
  assert.equal(explainChange(base, base).identical, true);
  const meta = explainChange(base, svg('{"v":"0.3.0"}', '<rect x="0" y="0" width="10" height="10" fill="#fff"/><text x="4" y="20" font-size="14">文字</text>'));
  assert.equal(meta.visual, false); assert.match(meta.lines.join(), /メタデータのみ/);
  const inv = explainChange(base, svg('{"v":"0.2.0"}', '<rect x="0" y="0" width="10" height="10" fill="#fff"/><rect x="1" y="1" width="24" height="24" fill="#fff" fill-opacity="0"/><text x="4" y="20" font-size="14">文字</text>'));
  assert.equal(inv.visual, false); assert.match(inv.lines.join(), /不可視の下地.*\+1/);
  const moved = explainChange(base, svg('{"v":"0.2.0"}', '<rect x="0" y="0" width="10" height="10" fill="#fff"/><text x="4" y="30" font-size="14">文字</text>'));
  assert.equal(moved.visual, true); assert.match(moved.lines.join(), /文字の移動: 1 件/);
  const shape = explainChange(base, svg('{"v":"0.2.0"}', '<rect x="0" y="0" width="10" height="10" fill="#fff"/><circle cx="5" cy="5" r="4" fill="#000"/><text x="4" y="20" font-size="14">文字</text>'));
  assert.match(shape.lines.join(), /図形の増減: \+1/);
});

test('config: .svg-diagram.json is found from a subdirectory; a diagram own accept wins', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
  fs.mkdirSync(path.join(root, 'a', 'b'), {recursive: true});
  fs.writeFileSync(path.join(root, '.svg-diagram.json'), JSON.stringify({accept: {density: '一覧のため', 'edge-crossings': '依存が多い'}, maxWidth: 1000}));
  const cfg = loadConfig(path.join(root, 'a', 'b'));
  assert.equal(cfg.maxWidth, 1000);
  const d = applyConfig<Pick<DiagramData, 'accept' | 'maxWidth'>>({accept: {density: '図ごとの理由'}}, cfg);
  assert.deepEqual(d.accept, {density: '図ごとの理由', 'edge-crossings': '依存が多い'});
  assert.equal(d.maxWidth, 1000);
  assert.deepEqual(loadConfig(os.tmpdir()), {}, 'no config found');
});

// ---- the command, end to end (no browser is needed for --docs) ---------------------------------
function project(mdBody: string, extra: {orphan?: boolean} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-'));
  fs.mkdirSync(path.join(root, 'docs'), {recursive: true}); fs.mkdirSync(path.join(root, 'src')); fs.mkdirSync(path.join(root, 'svg'));
  fs.writeFileSync(path.join(root, 'svg', 'fig.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  if (extra.orphan) fs.writeFileSync(path.join(root, 'svg', 'orphan.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  fs.writeFileSync(path.join(root, 'src', 'fig.mjs'), `import {diagram, wireframe, wf} from 'svg-diagram';
export default () => { const d = diagram({theme: 'blue', title: 't'}); d.add(wireframe(wf.col([wf.btn('a', {n: 1}), wf.btn('b', {n: 2})]), {title: 'S', notes: [{title: '一つ目', text: '本文一'}, {title: '二つ目', text: '本文二'}]})); return d; };`);
  fs.writeFileSync(path.join(root, 'docs', 'page.md'), mdBody);
  return root;
}
const run = (root: string, ...extra: string[]) => spawnSync('node', [CHECK, '--docs', 'docs', '--svg-dir', 'svg', '--src-dir', 'src', ...extra], {cwd: root, encoding: 'utf8'});
const GOOD = '# P\n\n![二つのボタンを持つ画面](../svg/fig.svg)\n\n1. **一つ目**：本文一\n2. **二つ目**：本文二\n';

test('check --docs: a page that agrees with its figure passes', () => {
  const r = run(project(GOOD), '--strict');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('check --docs: a note edited in the figure but not in the page, a missing image, a long alt and an orphan are all reported', () => {
  const stale = run(project(GOOD.replace('本文二', '古い本文')), '--strict');
  assert.equal(stale.status, 1); assert.match(stale.stdout, /\[doc-notes-mismatch\].*注釈 2「二つ目」の本文が違う/);
  const missing = run(project(GOOD + '\n![x](../svg/none.svg)\n'));
  assert.equal(missing.status, 1); assert.match(missing.stdout, /\[doc-image-missing\]/);
  const long = run(project(GOOD.replace('二つのボタンを持つ画面', 'あ'.repeat(160))), '--strict');
  assert.equal(long.status, 1); assert.match(long.stdout, /\[doc-alt-long\].*160 文字/);
  const orphan = run(project(GOOD, {orphan: true}), '--strict');
  assert.equal(orphan.status, 1); assert.match(orphan.stdout, /orphan\.svg \[doc-orphan-svg\]/);
});

test('check --docs --format json / github', () => {
  const root = project(GOOD.replace('本文二', '古い本文'));
  const j = JSON.parse(run(root, '--format', 'json').stdout);
  assert.equal(j.warnings, 1); assert.equal(j.findings[0].rule, 'doc-notes-mismatch'); assert.equal(j.findings[0].line, 3);
  assert.match(run(root, '--format', 'github').stdout, /^::warning file=docs\/page\.md,line=3,title=doc-notes-mismatch::/m);
});

test('formatNotes writes the list that compareNotes accepts', () => {
  const notes = ['題名なし', {title: '検索', text: '品名で絞る。'}, {n: 5, title: '保存', text: '右下に出す。'}];
  const md = formatNotes(notes);
  assert.equal(md, '1. 題名なし\n2. **検索**：品名で絞る。\n5. **保存**：右下に出す。');
  const items = scanMarkdown(`![a](x.svg)\n\n${md}\n`)[0].items;
  assert.deepEqual(compareNotes(items, notes, 'x'), []);
});

test('formatMap lists each figure once with its documents, and marks the unreferenced', () => {
  const t = formatMap([
    {name: 'b', svg: 'svg/b.svg', doc: 'd/1.md:3', src: 'src/b.ts'},
    {name: 'b', svg: 'svg/b.svg', doc: 'd/2.md:9', src: 'src/b.ts'},
    {name: 'a', svg: 'svg/a.svg', doc: '', src: ''},
  ]);
  const rows = t.split('\n');
  assert.equal(rows.length, 4);
  assert.match(rows[2], /^\| a \| — \| `svg\/a.svg` \| （参照なし） \|$/);
  assert.match(rows[3], /`d\/1.md:3`<br>`d\/2.md:9`/);
});

test('formatNotes keeps an item on one line; formatMap keeps same-named figures in different folders apart', () => {
  assert.equal(formatNotes([{title: 'T', text: '一行目\n  二行目'}]), '1. **T**：一行目 二行目');
  const t = formatMap([{name: 'f', svg: 'a/f.svg', doc: 'd.md:1', src: ''}, {name: 'f', svg: 'b/f.svg', doc: '', src: ''}]);
  assert.equal(t.split('\n').length, 4);
});

test('checkFigures: captions must run 図N-1, N-2 ... in the file chapter; references must name a real figure', () => {
  const page = (raw: string, ch: number | null = 3) => { const body = raw.replace(/!\[([a-z])\]/g, '![説明$1]'); const figs = scanMarkdown(body); return checkFigures(body, figs, ch).map(f => `${f.rule}@${f.line}`); };
  const ok = '![画面](a.svg)\n*図3-1　画面*\n\n本文は図3-2を見る。\n\n![表](b.svg)\n*図3-2　表*\n';
  assert.deepEqual(page(ok), []);
  assert.deepEqual(page('![a](a.svg "t")\n![x](a.svg)\n*図3-1 x*\n\n![y](b.svg)\n*図3-3 y*\n'), ['doc-fig-number@6'], 'gap');
  assert.deepEqual(page('![a](a.svg)\n図3-1 a\n\n![b](b.svg)\n図3-1 b\n'), ['doc-fig-number@5'], 'duplicate');
  assert.deepEqual(page('![a](a.svg)\n図3-2 a\n\n![b](b.svg)\n図3-1 b\n'), ['doc-fig-number@2', 'doc-fig-number@5'], 'out of order');
  assert.deepEqual(page('![a](a.svg)\n図4-1 a\n'), ['doc-fig-number@2'], 'chapter of the file is 3');
  assert.deepEqual(page('![a](a.svg)\n図4-1 a\n', null), [], 'no chapter in the file name: only consistency');
  assert.deepEqual(page('![図3-1 画面](a.svg)\n\n図3-4 を参照。図2-9 は別章。\n'), ['doc-fig-ref-missing@3'], 'alt caption; dangling reference');
  assert.deepEqual(page('![a](a.svg)\n図3-1 a\n\n```\n図3-7\n```\n'), [], 'fenced code is ignored');
  assert.deepEqual(page('![image](a.svg)\n![a](a.svg)\n1. x\n3. y\n'), ['doc-alt-placeholder@1', 'doc-notes-number@2']);
  assert.deepEqual(page('![構成図](a.svg)\n\n図3-1と同じく…\n\n![流れ](b.svg)\n*図3-1 流れ*\n'), [], 'a sentence starting with 図N-M is not a caption');
  assert.deepEqual(page('図3-1 構成\n\n![a](a.svg)\n\n図3-2 流れ\n\n![b](b.svg)\n'), [], 'captions above the figures');
  assert.deepEqual(page('![a](a.svg)\n*図3-1 a*\n\n1. **a**：x\n1. **b**：y\n\n`図3-9` と書く。\n'), [], 'lazy 1. numbering; inline code');
  assert.equal(chapterOf('2026-10-13-post.md'), null);
  assert.deepEqual([3, 12, 7, null].map((_, i) => chapterOf(['03-a.md', 'ch12.md', 'chapter-7_x.md', 'intro.md'][i])), [3, 12, 7, null]);
  assert.ok(globToRegExp('docs/**/03-*.md').test('docs/a/b/03-x.md') && !globToRegExp('docs/*.md').test('docs/a/x.md'));
  assert.ok(matchesAny([globToRegExp('03-*.md')], 'docs/03-x.md') && matchesAny([], 'any.md'));
});

test('check --docs: one chapter alone (file or --only), several --docs, and orphans only when every page is in scope', () => {
  const root = project(GOOD, {orphan: true});
  fs.writeFileSync(path.join(root, 'docs', '02-other.md'), '# O\n\n![別の図](../svg/orphan.svg)\n\n図2-1 別\n');
  const one = run(root, '--strict', '--only', 'docs/page.md');
  assert.equal(one.status, 0, one.stdout + one.stderr); assert.match(one.stdout, /検査は行わない/); assert.doesNotMatch(one.stdout, /\[doc-orphan-svg\]/);
  const file = spawnSync('node', [CHECK, '--docs', 'docs/page.md', '--svg-dir', 'svg', '--strict'], {cwd: root, encoding: 'utf8'});
  assert.equal(file.status, 0, file.stdout + file.stderr);
  const two = spawnSync('node', [CHECK, '--docs', 'docs/page.md', '--docs', 'docs/02-other.md', '--svg-dir', 'svg', '--strict'], {cwd: root, encoding: 'utf8'});
  assert.equal(two.status, 0, two.stdout + two.stderr);
  fs.writeFileSync(path.join(root, 'svg', 'lonely.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  const all = run(root, '--strict');
  assert.equal(all.status, 1); assert.match(all.stdout, /lonely\.svg \[doc-orphan-svg\]/);
  fs.writeFileSync(path.join(root, 'docs', '02-other.md'), '# O\n\n![別の図](../svg/orphan.svg)\n図2-2 別\n');
  const none = run(root, '--only', 'docs/nope-*.md');
  assert.equal(none.status, 2); assert.match(none.stderr, /合う文書がない/);
  const bad = run(root, '--strict', '--only', '02-*.md');
  assert.equal(bad.status, 1); assert.match(bad.stdout, /02-other\.md:4 \[doc-fig-number\]/);
});
