// check --covers: table cells vs the text of the built figure.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {readTable, figureText, checkCovers, normalize, tokensOf} from '../lib/covers.ts';

const CHECK = new URL('../check-diagram.ts', import.meta.url).pathname;
const svg = (...t: string[]) => `<svg xmlns="http://www.w3.org/2000/svg">${t.map(x => `<text>${x}</text>`).join('')}</svg>`;

test('readTable: Markdown skips the rule line and strips emphasis; CSV honours quotes', () => {
  const md = ['text', '| 項目 | 値 |', '|---|:-:|', '| **東京支店** | 1,200 |'].join('\n');
  assert.deepEqual(readTable(md, 'md').map(c => c.text), ['項目', '値', '東京支店', '1,200']);
  assert.deepEqual(readTable('a,"b,c",""\n"x ""y""",z', 'csv').map(c => c.text), ['a', 'b,c', 'x "y"', 'z']);
});

test('normalize: width, case, space, punctuation and digit grouping do not matter', () => {
  assert.equal(normalize('ＡＢＣ １２３'), normalize('abc123'));
  assert.equal(normalize('1,200 円'), normalize('1200円'));
});

test('tokensOf: proper nouns and numbers, not particles', () => {
  assert.deepEqual(tokensOf('Redis に 3.5% の キャッシュ を 置く').sort(), ['3.5', 'redis', 'キャッシュ'].map(normalize).sort());
});

test('checkCovers: whole cell, token match and missing tokens', () => {
  const cells = readTable('| 30 |\n|-|\n| 東京支店 |\n| 承認フロー 30日 |\n| 大阪支店 480件 |', 'md');
  const lost = checkCovers(cells, '東京 支店 / 30 日で承認フロー');
  assert.deepEqual(lost.map(u => [u.cell.text, u.missing]), [['大阪支店 480件', ['大阪支店', '480']]]);
  assert.equal(checkCovers(readTable('| a |\n|-|\n| a |', 'md'), figureText(svg('A'))).length, 0);
});

test('checkCovers: a number is not found inside a longer one, and the missing tokens are shown as written', () => {
  const lost = (t: string, f: string) => checkCovers(readTable(t, 'md'), f).map(u => u.missing);
  assert.deepEqual(lost('| 30 |', '300 件'), [['30']]);
  assert.deepEqual(lost('| 3.5% |', '35%'), [['3.5%']]);
  assert.deepEqual(lost('| 12 |', 'Q1 2'), [['12']]);
  assert.deepEqual(lost('| 30 |', '30日'), []);
  assert.deepEqual(lost('| 1,200 円 |', '合計 1200円'), []);
  assert.deepEqual(lost('| サーバー 構成 |', '構成'), [['サーバー']]);
});

test('check --covers: lists the missing cells and exits 0 (warning), 1 with --strict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'covers-'));
  fs.writeFileSync(path.join(dir, 'f.svg'), svg('東京支店', '120'));
  fs.writeFileSync(path.join(dir, 't.md'), '| 支店 | 件数 |\n|---|---|\n| 東京支店 | 120 |\n| 大阪支店 | 480 |\n');
  const run = (...a: string[]) => spawnSync('node', [CHECK, '--covers', path.join(dir, 't.md'), ...a, path.join(dir, 'f.svg')], {encoding: 'utf8', cwd: dir});
  const r = run();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /大阪支店/);
  assert.match(r.stdout, /480/);
  assert.doesNotMatch(r.stdout, /「東京支店」/);
  assert.equal(run('--strict').status, 1);
});
