import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, icon, iconRow, renderDiagram, row} from '../lib/dsl.ts';
import {EMOJIS, ICON_PATHS} from '../lib/icons.ts';
import type {EmojiName, IconName} from '../lib/icons.ts';
import {ALLOWED_COLORS, EMOJI_RE} from '../lib/tokens.ts';
import {fontCoverage, measureWithFonts} from '../lib/font-metrics.ts';
import {xmlProblems} from '../lib/xml-check.ts';

test.after(() => closeMeasurer());

const pathNames = Object.keys(ICON_PATHS) as IconName[];
const emojiNames = Object.keys(EMOJIS) as EmojiName[];
const emojiFont = fontCoverage('emoji');

test('every path icon is one non-empty d, a square source viewBox, and well-formed as XML', () => {
  assert.ok(pathNames.length >= 20 && pathNames.length <= 30);
  for (const n of pathNames) {
    const {d, vb, from, src} = ICON_PATHS[n];
    assert.ok(d.length > 20, n);
    assert.ok(vb[2] > 0 && from && src, n);
    assert.ok(!d.includes('"') && !d.includes('<'), n);
    assert.deepEqual(xmlProblems(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`), [], n);
  }
});

test('the path set covers the metaphors and records where each came from', () => {
  for (const n of ['person', 'people', 'document', 'folder', 'key', 'lock', 'bridge', 'fence', 'stairs', 'warning', 'check', 'close', 'idea', 'search', 'gear', 'cloud', 'database', 'mail', 'shield', 'flag', 'clock']) assert.ok(icon.has(n).path, n);
  assert.ok(new Set(pathNames.map(n => ICON_PATHS[n].from)).size === 2, 'both sources are used');
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
  assert.throws(() => box({icon: 'nope' as IconName, title: 'x'}), /unknown icon "nope"/);
  assert.throws(() => iconRow([{icon: 'nope' as IconName, label: 'x'}]), /unknown icon/);
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
