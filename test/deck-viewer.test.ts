// ADR 0018 unit C: the viewer's assets (lib/deck-viewer/*), checked on the document's structure and, without a browser, by running the
// script against a minimal DOM (test/helpers/mini-dom.ts). Nothing here reads a size or a position (the fonts differ between machines).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {viewerAssets, joinScript} from '../lib/deck-viewer.ts';
import {buildDeck, externalRefs} from '../lib/deck-html.ts';
import {deckPage, type El} from './helpers/mini-dom.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const out = (n: string) => fs.readFileSync(path.join(ROOT, 'examples/out', `${n}.svg`), 'utf8');
const NAMES = ['bars', 'bpmn', 'bars'];

const run = (page: ReturnType<typeof deckPage>) => {
  vm.runInNewContext(viewerAssets().js, {document: page.doc, window: page.window});
  return page;
};

// ---- the assets and the document ----

test('the assets are plain files; the script is state.js and viewer.js joined, with no import / export left', () => {
  for (const f of ['state.js', 'viewer.js', 'viewer.css']) assert.ok(fs.existsSync(path.join(ROOT, 'lib/deck-viewer', f)), f);
  const {css, js} = viewerAssets();
  assert.doesNotMatch(js, /^\s*(import|export)\s/m);
  assert.doesNotMatch(js, /<\/script/i);
  assert.doesNotMatch(css, /<\/style/i);
  assert.match(js, /function reduce\(/);
  assert.match(js, /function startViewer\(/);
  assert.equal(viewerAssets().js, js, 'the same bytes each time');
  assert.throws(() => joinScript('export default 1;\n', 'x'), /import \/ export/);
});

test('the assets name no external resource and the script sets no style attribute', () => {
  const {css, js} = viewerAssets();
  assert.doesNotMatch(css, /@import|url\(/);
  assert.doesNotMatch(js, /https?:\/\/|\.style\b|setAttribute\(\s*['"]style/);
});

test('the stylesheet: no-js shows every slide; print is one slide per page; the frame follows the colour scheme, the panel the figure', () => {
  const {css} = viewerAssets();
  assert.match(css, /\.no-js \.slide/);
  assert.match(css, /html:not\(\.no-js\) #deck/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /\.slide-dark \{ background: #1b1a17 \}/);
  assert.match(css, /\.slide \{[^}]*background: #ffffff/);
  const print = css.slice(css.indexOf('@media print'));
  assert.match(print, /break-after: page/);
  assert.match(print, /\.slide\[hidden\]/);
  assert.doesNotMatch(css, /@page/, 'the one @page comes from buildDeck (the largest figure)');
  assert.doesNotMatch(css, /animation|transition/, 'no motion (ADR 0018 D7)');
});

const doc = (csp = false) => {
  const {css, js} = viewerAssets();
  return buildDeck(NAMES.map(n => ({name: n, svg: out(n)})), {css, js, csp});
};

test('a deck with the real viewer: ids are unique, nothing external, one style and one script, same bytes twice', () => {
  const html = doc();
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'every id is unique');
  assert.equal([...html.matchAll(/<section\b/g)].length, 3);
  assert.equal([...html.matchAll(/<style\b/g)].length, 1);
  assert.equal([...html.matchAll(/<script\b/g)].length, 1);
  assert.deepEqual(externalRefs(html.replace(/xmlns="[^"]*"/g, '')), []);
  assert.doesNotMatch(html, /\sstyle="/);
  assert.match(html, /<html lang="ja" class="no-js">/);
  assert.equal(doc(), html);
});

test('the CSP hashes are the SHA-256 of the one style and the one script', () => {
  const html = doc(true);
  const sha = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)![1]!;
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
  const meta = /Content-Security-Policy" content="([^"]*)"/.exec(html)![1]!;
  assert.ok(meta.includes(`style-src ${sha(style)}`));
  assert.ok(meta.includes(`script-src ${sha(script)}`));
});

// ---- the script, on a minimal DOM ----

test('on load: no-js is removed, the first slide is shown, the rest hidden; the frame is made; a hash picks the slide', () => {
  const p = run(deckPage(3));
  assert.equal(p.doc.documentElement.classList.contains('no-js'), false);
  assert.deepEqual(p.visible(), [true, false, false]);
  assert.equal(p.slides[0]!.getAttribute('aria-current'), 'true');
  assert.equal(p.bar().children.length, 4);
  assert.equal(p.slides.every(s => s.children.some(c => c.classList.contains('deck-pick'))), true);

  const q = deckPage(3); q.win.hash = '#3'; run(q);
  assert.deepEqual(q.visible(), [false, false, true]);
  const r = deckPage(3); r.win.hash = '#two'; run(r);
  assert.deepEqual(r.visible(), [false, true, false]);
  const s = deckPage(3); s.win.hash = '#nope'; run(s);
  assert.deepEqual(s.visible(), [true, false, false]);
});

test('keys move, stop at the ends, update the hash with replaceState, and say it in the live region', () => {
  const p = run(deckPage(3));
  const press = (k: string, mods: Record<string, unknown> = {}) => p.doc.key(k, mods);
  assert.equal(press('ArrowRight').defaultPrevented, true);
  assert.deepEqual(p.visible(), [false, true, false]);
  assert.equal(p.win.hash, '#2');
  assert.equal(p.live().textContent, '2 / 3: two');
  press('PageDown'); press('ArrowRight'); // the end: stays
  assert.deepEqual(p.visible(), [false, false, true]);
  press(' ', {shiftKey: true});
  assert.deepEqual(p.visible(), [false, true, false]);
  press('Home'); assert.equal(p.win.hash, '#1');
  press('End'); assert.equal(p.win.hash, '#3');
  press('PageUp'); press(' ');
  assert.equal(p.win.hash, '#3');
  assert.deepEqual(p.win.pushed, [], 'moving never pushes a history entry');
  assert.ok(p.win.replaced.length >= 5);
});

test('keys the viewer must leave alone: Ctrl/Alt/Meta, typing in a field, Space on a button / link / summary', () => {
  const p = run(deckPage(3));
  assert.equal(p.doc.key('ArrowRight', {ctrlKey: true}).defaultPrevented, false);
  assert.equal(p.doc.key('ArrowRight', {metaKey: true}).defaultPrevented, false);
  const input = p.doc.createElement('input');
  assert.equal(p.doc.key('ArrowRight', {}, input).defaultPrevented, false);
  for (const tag of ['button', 'a', 'summary']) assert.equal(p.doc.key(' ', {}, p.doc.createElement(tag)).defaultPrevented, false, tag);
  assert.deepEqual(p.visible(), [true, false, false]);
  assert.equal(p.doc.key('ArrowRight', {}, p.doc.createElement('button')).defaultPrevented, true, 'the arrow keys still work on a button');
});

test('the frame buttons move; the ends disable them', () => {
  const p = run(deckPage(3));
  const [prev, , next] = p.bar().children as [El, El, El];
  assert.equal(prev.hasAttribute('disabled'), true);
  next.fire('click');
  assert.deepEqual(p.visible(), [false, true, false]);
  assert.equal(prev.hasAttribute('disabled'), false);
  next.fire('click');
  assert.equal(next.hasAttribute('disabled'), true);
  prev.fire('click');
  assert.equal(p.win.hash, '#2');
});

test('the overview: the same sections, no copy; one button per section is focused; only the frame controls are inert; svg are aria-hidden', () => {
  const p = run(deckPage(3));
  const count = () => ({svg: p.deck.querySelectorAll('svg').length, sections: p.deck.querySelectorAll('.slide').length, ids: p.deck.all().filter(e => e.hasAttribute('id')).length});
  const before = count();
  p.doc.key('ArrowRight'); // on slide 2
  p.doc.key('g');
  assert.equal(p.deck.classList.contains('grid'), true);
  assert.deepEqual(count(), before, 'the overview creates no svg, no section and no id');
  assert.deepEqual(p.visible(), [true, true, true]);
  assert.equal(p.win.hash, '#grid');
  assert.deepEqual(p.win.pushed, ['#grid'], 'the overview alone is pushed');
  // focus on the current slide's button
  const pick = (s: El) => s.children.find(c => c.classList.contains('deck-pick'))!;
  assert.equal(p.doc.activeElement, pick(p.slides[1]!));
  assert.equal(pick(p.slides[1]!).getAttribute('aria-label'), '2 / 3: two');
  // inert: the bar's prev / next, never #deck or a section
  const [prev, , next, gridBtn] = p.bar().children as [El, El, El, El];
  assert.equal(prev.hasAttribute('inert') && next.hasAttribute('inert'), true);
  assert.equal(gridBtn.hasAttribute('inert'), false);
  assert.equal(p.deck.hasAttribute('inert'), false);
  assert.equal(p.slides.some(s => s.hasAttribute('inert')), false);
  assert.equal(p.slides.every(s => s.querySelector('svg')!.getAttribute('aria-hidden') === 'true'), true);
  assert.equal(p.live().textContent, '一覧 (3)');
  // Space on the focused slide button is the button's, not "next"
  assert.equal(p.doc.key(' ').defaultPrevented, false);
  // pick: select slide 3, leave the overview, focus back on #deck, svg are exposed again
  pick(p.slides[2]!).fire('click');
  assert.equal(p.deck.classList.contains('grid'), false);
  assert.deepEqual(p.visible(), [false, false, true]);
  assert.equal(p.win.hash, '#3');
  assert.equal(p.doc.activeElement, p.deck);
  assert.equal(p.slides.some(s => s.querySelector('svg')!.hasAttribute('aria-hidden')), false);
  assert.equal(prev.hasAttribute('inert') || next.hasAttribute('inert'), false);
  assert.deepEqual(count(), before);
});

test('Esc and g close the overview; Esc outside it does nothing; the browser back closes it through the hash', () => {
  const p = run(deckPage(3));
  assert.equal(p.doc.key('Escape').defaultPrevented, false);
  p.doc.key('g'); assert.equal(p.deck.classList.contains('grid'), true);
  p.doc.key('Escape');
  assert.equal(p.deck.classList.contains('grid'), false);
  assert.equal(p.doc.activeElement, p.deck);
  p.doc.key('g'); p.doc.key('g');
  assert.equal(p.deck.classList.contains('grid'), false);
  p.doc.key('g');
  p.navigateHash('#1'); // back
  assert.equal(p.deck.classList.contains('grid'), false);
  assert.deepEqual(p.visible(), [true, false, false]);
  p.navigateHash('#grid');
  assert.equal(p.deck.classList.contains('grid'), true);
  p.navigateHash('#three');
  assert.deepEqual(p.visible(), [false, false, true]);
});

test('arrows in the overview move the current slide and keep the focus on its button', () => {
  const p = run(deckPage(3));
  p.doc.key('g');
  p.doc.key('ArrowRight');
  assert.equal(p.slides[1]!.getAttribute('aria-current'), 'true');
  assert.equal(p.doc.activeElement, p.slides[1]!.children.find(c => c.classList.contains('deck-pick')));
  assert.equal(p.deck.classList.contains('grid'), true);
});

test('zoom: z and a click toggle it, a move resets it, and the overview has none', () => {
  const p = run(deckPage(3));
  p.doc.key('z'); assert.equal(p.deck.classList.contains('zoom'), true);
  p.doc.key('z'); assert.equal(p.deck.classList.contains('zoom'), false);
  p.deck.fire('click', {target: p.slides[0]!.children[0]});
  assert.equal(p.deck.classList.contains('zoom'), true);
  p.doc.key('ArrowRight'); assert.equal(p.deck.classList.contains('zoom'), false);
  p.doc.key('g');
  assert.equal(p.doc.key('z').defaultPrevented, false);
  p.deck.fire('click', {target: p.slides[0]!.children[0]});
  assert.equal(p.deck.classList.contains('zoom'), false, 'no zoom in the overview, by key or by click');
});

test('English frame labels when the page is not Japanese', () => {
  const p = run(deckPage(2, undefined, 'en'));
  assert.equal(p.bar().children[0]!.getAttribute('aria-label'), 'Previous slide');
});
