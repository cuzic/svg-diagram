// ADR 0067: the pure part of `svg-diagram site` — site.json, the slugs, extra paths, _headers, manifest.json, slides.json, what in DIR
// `site` did not write — and the static viewer page (transport 'static', relative assets, a <meta> CSP).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {assignSlugs, extraClash, extraPathProblem, headersFile, isInside, manifestJson, onlyOsFiles, parseSite, slidesJson, slugify, slugSource, strangers, writtenBefore} from '../lib/site.ts';
import {PAGE_CSP, PAGE_CSP_META, PRESENT_JS, printPage, siteIndexPage, SVG_CSP, viewerPage} from '../lib/present/ui.ts';
import {PAGE_HEADERS, SVG_HEADERS} from '../lib/present/guard.ts';

const at = (deck: string, slug?: string) => ({deck: path.resolve(deck), slug, place: deck});

test('site.json: paths relative to it, unknown fields and bad values named with their place', () => {
  const got = parseSite({title: 'T', decks: [{deck: 'a/deck.json', slug: 'x', title: '題'}, {deck: 'b.json'}], extra: {CNAME: 'files/CNAME'}}, '/p/site.json');
  assert.ok(got.ok);
  assert.deepEqual(got.plan.decks.map(d => [d.deck, d.slug, d.title]), [['/p/a/deck.json', 'x', '題'], ['/p/b.json', undefined, undefined]]);
  assert.deepEqual(got.plan.extra, [{to: 'CNAME', from: '/p/files/CNAME'}]);
  const bad = parseSite({decks: [{deck: 1}, {deck: 'a.json', colour: 1}], extra: {'../x': 'y', '/abs': 'y'}, more: 1}, '/p/site.json');
  assert.ok(!bad.ok);
  const text = bad.errors.join('\n');
  for (const s of ['unknown field "more"', 'decks[0].deck', 'decks[1]: unknown field "colour"', 'extra["../x"]', 'extra["/abs"]']) assert.ok(text.includes(s), s);
  assert.ok(!parseSite({decks: []}, 'site.json').ok);
});

test('extra paths: relative POSIX paths in DIR only; not onto the site\'s own files', () => {
  for (const ok of ['CNAME', '.well-known/security.txt', 'robots.txt']) assert.equal(extraPathProblem(ok), null, ok);
  for (const bad of ['', '/x', 'C:/x', 'a/../b', './a', 'a//b', 'a\\b', '..']) assert.ok(extraPathProblem(bad), bad);
  assert.equal(extraClash('CNAME', ['talk']), null);
  assert.ok(extraClash('index.html', []));
  assert.ok(extraClash('assets/x.css', []));
  assert.ok(extraClash('talk/x', ['talk']));
  assert.ok(extraClash('_headers/x', []));
  assert.ok(extraClash('Index.html', []) && extraClash('Assets/x', []) && extraClash('Talk/x', ['talk']));
});

test('slugs: made from the folder of a deck.json or the file name, normalized and cut to 64', () => {
  assert.equal(slugSource('/a/My Talk/deck.json'), 'My Talk');
  assert.equal(slugSource('/a/nov27.json'), 'nov27');
  assert.equal(slugify('My Talk_2026'), 'my-talk-2026');
  assert.equal(slugify('ＡＢＣ１２'), 'abc12'); // full-width letters and digits (NFKC)
  assert.equal(slugify('勉強会'), '');
  assert.equal(slugify(`${'a'.repeat(63)}-b`), 'a'.repeat(63));
  const r = assignSlugs([at('/x/My Talk/deck.json'), at('/x/勉強会/deck.json'), at('/x/第2回勉強会.json')]);
  assert.deepEqual(r.slugs, ['my-talk', 'deck-2', '2']);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 2); // 勉強会 → deck-2 and 第2回勉強会 → 2 changed too much
});

test('slugs: a written one is checked strictly; reserved names and two decks on one slug are errors', () => {
  assert.deepEqual(assignSlugs([at('/a.json', 'ok-1')]).errors, []);
  for (const bad of ['Upper', '-lead', 'a_b', 'x'.repeat(65), '']) assert.equal(assignSlugs([at('/a.json', bad)]).errors.length, 1, bad);
  for (const reserved of ['assets', 'cdn-cgi', 'p', 'api', 'auth']) assert.match(assignSlugs([at('/a.json', reserved)]).errors.join(), /reserved/);
  const twice = assignSlugs([at('/a/talk/deck.json'), at('/b/talk/deck.json')]);
  assert.equal(twice.errors.length, 1);
  assert.match(twice.errors[0] as string, /"talk".*site\.json "slug"/);
});

test('_headers: one * per rule, no "!" (Netlify has none), the slides\' CSP the one serve and the Worker send', () => {
  const h = headersFile();
  assert.ok(!h.includes('!'));
  for (const line of h.split('\n').filter(l => l.startsWith('/'))) assert.ok((line.match(/\*/g) ?? []).length <= 1, line);
  assert.ok(h.includes(`/:slug/s/*\n  Content-Security-Policy: ${SVG_CSP}\n`));
  assert.ok(h.includes("/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex\n  Content-Security-Policy: frame-ancestors 'none'\n"));
  assert.equal(SVG_HEADERS['content-security-policy'], SVG_CSP);
  assert.equal(PAGE_HEADERS['content-security-policy'], PAGE_CSP);
  assert.equal(PAGE_CSP, `${PAGE_CSP_META}; frame-ancestors 'none'`);
});

test('manifest.json and slides.json: sorted files, no notes, the page\'s field names', () => {
  const m = JSON.parse(manifestJson('T', ['b', 'a', 'a'], [{slug: 's', title: 'T', slides: 1, cover: 's/s/h.svg'}]));
  assert.deepEqual(m, {version: 1, generator: 'svg-diagram site', title: 'T', files: ['a', 'b'], decks: [{slug: 's', title: 'T', slides: 1, cover: 's/s/h.svg'}]});
  const s = JSON.parse(slidesJson('T', [{hash: 'h', title: '一', text: '一\n二', notes: 'secret'} as {hash: string; title: string; text: string}]));
  assert.deepEqual(s, {version: 1, title: 'T', slides: [{url: 's/h.svg', title: '一', text: '一\n二'}]});
});

test('DIR: only what site wrote, nobody added to; an OS\'s files ignored', () => {
  const manifest = manifestJson('T', ['index.html', 'a/s/x.svg', 'manifest.json'], []);
  const before = writtenBefore(manifest);
  assert.deepEqual(before?.files, ['a/s/x.svg', 'index.html', 'manifest.json']);
  assert.equal(writtenBefore(null), null);
  assert.equal(writtenBefore('{"generator": "other", "files": []}'), null);
  assert.equal(writtenBefore('not json'), null);
  assert.ok(onlyOsFiles(['.DS_Store', 'Thumbs.db']) && !onlyOsFiles(['.DS_Store', 'x']) && !onlyOsFiles(['a/']));
  const written = before?.files ?? [];
  assert.deepEqual(strangers(['a/', 'a/s/', 'a/s/x.svg', 'index.html', 'manifest.json', '.DS_Store', 'a/s/Thumbs.db'], written), []);
  assert.deepEqual(strangers(['CNAME', 'a/', 'a/s/', 'a/s/x.svg', 'b/', 'b/y'], written), ['CNAME', 'b/', 'b/y']);
  assert.ok(isInside('/d/x/y', '/d/x'));
  assert.ok(isInside('/d/x', '/d/x'));
  assert.ok(!isInside('/d/xy', '/d/x'));
});

test('the static viewer: relative assets, a <meta> CSP before the stylesheet, slides.json in its config', () => {
  const html = viewerPage('題', {role: 'viewer', transport: 'static', events: '', slides: 'slides.json', print: 'print.html'}, {js: '../assets/present.1.js', css: '../assets/present.1.css', csp: PAGE_CSP_META});
  const meta = html.indexOf('http-equiv="Content-Security-Policy"'), link = html.indexOf('<link rel="stylesheet" href="../assets/present.1.css">');
  assert.ok(meta > 0 && link > meta && html.indexOf('<meta charset="utf-8">') < meta);
  assert.ok(html.includes('<script src="../assets/present.1.js">'));
  assert.ok(html.includes('"transport":"static"') && html.includes('"slides":"slides.json"'));
  assert.ok(!html.includes('frame-ancestors'));
  // the served pages are as before: absolute assets, no <meta> CSP (their CSP is in the header)
  const served = viewerPage('題', {role: 'viewer', transport: 'sse', events: '/api/events'});
  assert.ok(served.includes('href="/assets/present.css"') && !served.includes('http-equiv'));
  assert.ok(printPage('題', [{url: 's/h.svg', text: 't'}], {js: '', css: '../a.css', csp: PAGE_CSP_META}).includes('href="../a.css"'));
  const index = siteIndexPage('<題>', [{href: 'a/', title: 'A & B', slides: 3, cover: 'a/s/h.svg'}], {css: 'assets/site.1.css', csp: PAGE_CSP_META});
  assert.ok(index.includes('&lt;題&gt;') && index.includes('alt="A &amp; B"') && index.includes('href="a/"') && !index.includes('<script'));
});

test('the page script parses (a String.raw slip would break every page), and the static page has no b / Enter to the presenter', () => {
  assert.doesNotThrow(() => new Function(PRESENT_JS));
  assert.ok(PRESENT_JS.includes("cfg.transport !== 'static' && (k === 'b' || k === 'Enter')"));
  assert.ok(PRESENT_JS.includes("if (cfg.transport === 'static') loadStatic();"));
});
