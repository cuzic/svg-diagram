// `svg-diagram diff --text old.svg new.svg`: which words and numbers of a hand-written SVG are gone from its DSL redraw (and which are new).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {formatTextCoverage, textCells, textCoverage} from '../lib/text-coverage.ts';

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100">${body}</svg>`;
const OLD = svg(`<text x="10" y="20">営業部の
<tspan x="10" y="40">売上は 1,200 万円</tspan></text><text x="10" y="60">Hello</text><text x="10" y="80">World 42%</text>`);

test('textCells: one cell per <text>; a tspan that starts a line is a break, a restyling tspan is not', () => {
  assert.deepEqual(textCells(svg('<text>Hel<tspan font-weight="bold">lo</tspan></text><text><tspan x="1" y="2">foo</tspan><tspan x="1" y="20">bar</tspan></text><text>  </text>')).map(c => c.text), ['Hello', 'foo bar']);
});

test('line wrapping, tspan splits, spacing, width, case and thousands separators do not count', () => {
  const wrapped = svg('<text>営業部の売上は</text><text>1200万円</text><text>ＨＥＬＬＯ world</text><text>42 %</text>');
  const r = textCoverage(OLD, wrapped);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.added, []);
});

test('a word or a number that is gone is listed with the label it was in; a new one is listed as added', () => {
  const changed = svg('<text>営業部の</text><text>売上は 1,300 万円</text><text>Hello World</text><text>Extra note</text>');
  const r = textCoverage(OLD, changed);
  assert.deepEqual(r.missing.map(u => [u.cell.text, u.missing]), [['営業部の 売上は 1,200 万円', ['1,200']], ['World 42%', ['42%']]]);
  assert.deepEqual(r.added.map(u => u.missing), [['1,300'], ['Extra', 'note']]);
  const lines = formatTextCoverage(r);
  assert.match(lines.join('\n'), /42%/);
  assert.match(lines.at(-1) ?? '', /2 件/);
  assert.doesNotMatch(formatTextCoverage(r, false).join('\n'), /Extra/);
});

test('a number is not found inside a longer one (30 is not in 300)', () => {
  assert.equal(textCoverage(svg('<text>30</text>'), svg('<text>300</text>')).missing.length, 1);
  assert.equal(textCoverage(svg('<text>3.5</text>'), svg('<text>35</text>')).missing.length, 1);
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-coverage-'));
const files = {old: path.join(dir, 'old.svg'), same: path.join(dir, 'same.svg'), lost: path.join(dir, 'lost.svg')};
fs.writeFileSync(files.old, OLD);
fs.writeFileSync(files.same, svg('<text>営業部の売上は 1200万円</text><text>hello</text><text>world 42%</text>'));
fs.writeFileSync(files.lost, svg('<text>営業部の売上は 1200万円</text><text>hello</text>'));
const run = (...args: string[]) => spawnSync(process.execPath, [path.resolve(import.meta.dirname, '..', 'diff-svg.ts'), ...args], {encoding: 'utf8'});

test('CLI: --text reports and exits 0; --strict exits 1 only when something of the old picture is missing', () => {
  const same = run('--text', files.old, files.same);
  assert.equal(same.status, 0, same.stderr);
  assert.match(same.stdout, /すべて新に残っている/);
  const lost = run('--text', files.old, files.lost);
  assert.equal(lost.status, 0);
  assert.match(lost.stdout, /42%/);
  assert.equal(run('--text', '--strict', files.old, files.lost).status, 1);
  assert.equal(run('--text', '--strict', files.old, files.same).status, 0);
  assert.doesNotMatch(run('--missing-text', files.old, files.lost).stdout, /新にあって旧にない/);
  assert.equal(run('--text', '--strict', '--no-added', files.lost, files.old).status, 0, 'only the old side counts');
});

test('CLI: usage errors exit 2 (unknown flag, --strict without --text, unreadable or malformed SVG)', () => {
  assert.equal(run('--bogus', files.old, files.same).status, 2);
  assert.equal(run('--strict', files.old, files.same).status, 2);
  assert.equal(run('--text', files.old).status, 2);
  assert.equal(run('--text', files.old, path.join(dir, 'nope.svg')).status, 2);
  const bad = path.join(dir, 'bad.svg');
  fs.writeFileSync(bad, '<svg><text>unclosed');
  assert.equal(run('--text', files.old, bad).status, 2);
  assert.equal(run(files.old, files.old).status, 0, 'plain diff is unchanged');
});
