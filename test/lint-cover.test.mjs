// lint-svg: a shape painted over a text, or a line through it, is reported (needs Chromium, like the layout does).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const LINT = new URL('../lint-svg.mjs', import.meta.url).pathname;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120"><rect width="400" height="120" fill="#ffffff"/><text x="40" y="64" font-size="14" font-weight="700" fill="#22201b">12% 低下 バッテリーの文字</text>${body}</svg>`;
const lint = (name, markup) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lint-')), name);
  fs.writeFileSync(f, svg(markup));
  return spawnSync('node', [LINT, f], {encoding: 'utf8'}).stdout;
};

test('a small shape painted over a long text is reported (a fraction-of-the-text threshold would miss it)', () => {
  const out = lint('over.svg', '<rect x="120" y="44" width="8" height="20" fill="#1d5fa8"/>');
  assert.match(out, /is covered by a rect/);
});

test('a line through the text is reported', () => {
  assert.match(lint('line.svg', '<path d="M60,40 L60,80" stroke="#22201b" stroke-width="2" fill="none"/>'), /is crossed by a path/);
});

test('a background drawn BEFORE the text, a shape clear of it, and data-allow-cover are all fine', () => {
  assert.doesNotMatch(lint('clear.svg', '<rect x="300" y="44" width="20" height="20" fill="#1d5fa8"/>'), /covered|crossed/);
  assert.doesNotMatch(lint('allow.svg', '<rect data-allow-cover="" x="120" y="44" width="8" height="20" fill="#1d5fa8"/>'), /covered|crossed/);
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lint-')), 'bg.svg');
  fs.writeFileSync(f, `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120"><rect width="400" height="120" fill="#ffffff"/><rect x="20" y="40" width="300" height="30" fill="#dce9f7"/><text x="40" y="64" font-size="14" fill="#22201b">背景の上の文字</text></svg>`);
  assert.doesNotMatch(spawnSync('node', [LINT, f], {encoding: 'utf8'}).stdout, /covered|crossed/);
});

test('several files named on the command line are all linted', () => {
  const a = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lint-')), 'a.svg'), b = path.join(path.dirname(a), 'b.svg');
  fs.writeFileSync(a, svg('')); fs.writeFileSync(b, svg('<rect x="120" y="44" width="8" height="20" fill="#1d5fa8"/>'));
  assert.match(spawnSync('node', [LINT, a, b], {encoding: 'utf8'}).stdout, /Scanned 2 file/);
});
