import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, icon, iconRow, renderDiagram, row} from '../lib/dsl.ts';
import {EMOJIS} from '../lib/icons.ts';
import type {EmojiName, IconName} from '../lib/icons.ts';
import {parseManifest} from '../lib/icon-store.ts';
import {ALLOWED_COLORS, EMOJI_RE} from '../lib/tokens.ts';
import {fontCoverage, measureWithFonts} from '../lib/font-metrics.ts';
import {xmlProblems} from '../lib/xml-check.ts';

test.after(() => closeMeasurer());

const emojiNames = Object.keys(EMOJIS) as EmojiName[];
const emojiFont = fontCoverage('emoji');
const ROOT_MANIFEST = fs.readFileSync(new URL('../svg-diagram.icons.json', import.meta.url), 'utf8');

test('this repo\'s own svg-diagram.icons.json (what the examples and tests draw) is a valid manifest that records each icon\'s source and licence', () => {
  const m = parseManifest(ROOT_MANIFEST, 'svg-diagram.icons.json');
  const names = Object.keys(m.icons);
  assert.ok(names.length >= 20);
  for (const n of ['person', 'people', 'document', 'folder', 'key', 'lock', 'bridge', 'fence', 'stairs', 'warning', 'check', 'close', 'idea', 'search', 'gear', 'cloud', 'database', 'mail', 'shield', 'flag', 'clock']) assert.ok(icon.has(n).path, n);
  for (const n of names) {
    const {d, from, license} = m.icons[n];
    assert.ok(d.length > 20 && from.includes(':') && license, n);
    assert.deepEqual(xmlProblems(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`), [], n);
  }
});

test('svg-diagram ships no icons: with none installed, box({icon}) throws and says how to install one', () => {
  icon.use({version: 1, icons: {}});
  try {
    assert.throws(() => box({icon: 'key', title: 'x'}), /icon "key" is not installed.*svg-diagram icons add mdi:<icon>=key/);
    assert.deepEqual(icon.pathNames, []);
    assert.deepEqual(icon.has('key'), {path: false, emoji: true});
  } finally { icon.use(undefined); }
  assert.ok(icon.has('key').path, 'back to the file');
});

test('icon.use() draws a project\'s own glyph; evenodd is kept', async () => {
  icon.use({version: 1, icons: {dot: {d: 'M2 2h20v20H2zM8 8v8h8V8z', vb: [0, 0, 24], rule: 'evenodd', from: 'file:dot.svg', license: 'local'}}});
  try {
    const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(box({icon: 'dot', title: '点'})), {name: 'dot.svg', budget: 'cacheOnly'});
    assert.match(svg, /<path d="M2 2h20v20H2zM8 8v8h8V8z" transform="[^"]+" fill="#[0-9a-f]{6}" fill-rule="evenodd" aria-hidden="true" data-icon="dot"\/>/);
  } finally { icon.use(undefined); }
});

test('every emoji is one code point inside EMOJI_RE (so emit gives it class="emoji")', () => {
  for (const n of emojiNames) {
    assert.equal([...icon.emoji(n)].length, 1, n);
    assert.ok(EMOJI_RE.test(icon.emoji(n)), `${n} ${icon.emoji(n)} is outside EMOJI_RE`);
  }
});

test('every emoji has a glyph in the emoji font and measures as an emoji, not the 1em fallback', {skip: emojiFont ? false : 'no emoji font file found'}, () => {
  for (const n of emojiNames) assert.ok(emojiFont!.has(icon.emoji(n).codePointAt(0)!), `${n} is missing from the emoji font`);
  const m = measureWithFonts(new Map(emojiNames.map(n => [n, {text: icon.emoji(n), size: 100}])));
  for (const n of emojiNames) assert.notEqual(m.get(n)!.w, 100, `${n} measured as the 1em fallback`);
});

test('icon.has says which set has a name; unknown names throw', () => {
  assert.deepEqual(icon.has('key'), {path: true, emoji: true});
  assert.deepEqual(icon.has('stairs'), {path: true, emoji: false});
  assert.deepEqual(icon.has('ladder'), {path: false, emoji: true});
  assert.deepEqual(icon.has('toString'), {path: false, emoji: false});
  assert.throws(() => icon.emoji('nope' as EmojiName), /unknown emoji icon "nope"/);
  assert.throws(() => icon.emoji('toString' as EmojiName), /unknown emoji icon/);
  assert.throws(() => box({icon: 'nope' as IconName, title: 'x'}), /icon "nope" is not installed/);
  assert.throws(() => iconRow([{icon: 'nope' as IconName, label: 'x'}]), /not installed/);
  assert.throws(() => iconRow([]), /at least one/);
});

test('box({icon}) and box({step}) cannot be combined', () => {
  assert.throws(() => box({icon: 'key', step: 1, title: 'x'} as never), /icon.*step|step.*icon/);
});

test('an emoji inside a title is drawn with class="emoji" and passes the check', async () => {
  const d = diagram({theme: 'blue'}).add(row([box({title: `${icon.emoji('key')} 鍵の管理`, body: '発行と失効'}), box({title: `${icon.emoji('bridge')}${icon.emoji('fence')} 橋と柵`})]));
  const {svg, verdict} = await renderDiagram(d, {name: 'icons.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  assert.match(svg, /<tspan class="emoji">🔑<\/tspan> 鍵の管理/);
});

test('box({icon}) indents every run, makes room for the icon, and a box without one is unchanged', async () => {
  const plain = (await checkDiagram(diagram({theme: 'blue'}).add(box({id: 'a', title: 'T'})))).laidOut.laidOut[0] as {h: number; wrappedRuns: object[]};
  assert.ok(plain.wrappedRuns.every(r => !('indent' in r) || (r as {indent: number}).indent === 0));
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(box({icon: 'key', title: 'T', body: 'B', note: 'N'})));
  const b = laidOut.laidOut[0] as {wrappedRuns: {indent?: number}[]};
  assert.ok(b.wrappedRuns.every(r => r.indent! >= 32), 'every run is pushed right of the icon');
  const one = (await checkDiagram(diagram({theme: 'blue'}).add(box({icon: 'key', title: 'T'})))).laidOut.laidOut[0] as {h: number};
  assert.ok(one.h >= 32 + 32, 'the icon sets a minimum height');
});

test('box({icon}) draws a path in a token colour, muted when dimmed, and iconRow() puts them side by side', async () => {
  const d = diagram({theme: 'blue', spotlight: 'on'}).add(
    row([box({id: 'on', icon: 'lock', iconTone: 'accent', title: '鍵', body: '本文'}), box({id: 'off', icon: 'person', title: '人', body: '本文'})]),
    iconRow([{icon: 'bridge', label: '橋'}, {icon: 'fence', label: '柵', iconTone: 'danger'}, {icon: 'stairs', label: '階段'}]),
  );
  const {svg, verdict} = await renderDiagram(d, {name: 'icons.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  const paths = [...svg.matchAll(/<path d="[^"]+" transform="translate\(([\d. -]+)\) scale\(([\d.]+)\)" fill="(#[0-9a-f]{6})" aria-hidden="true" data-icon="(\w+)"\/>/g)];
  assert.deepEqual(paths.map(m => m[4]), ['lock', 'person', 'bridge', 'fence', 'stairs']);
  for (const m of paths) assert.ok(ALLOWED_COLORS.has(m[3]), `${m[4]} fill ${m[3]} is a token`);
  assert.notEqual(paths[0][3], paths[1][3], 'the focused box keeps its tone, the dimmed one is muted');
});
