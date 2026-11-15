// ADR 0056 D1, D5, D6, D8, D9: `svg-diagram serve` started on a free port in a temp project — the pages, the event stream, the presenter's
// token, a presenter's go reaching a viewer, a viewer's go refused, drawing again on save, the presenter's own data, the guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {JA_FONTS} from './helpers/text-engine.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-cli-'));
const deckFile = path.join(proj, 'deck.json');
const figure = {version: 1, title: '流れ', parts: [{type: 'flowchart', nodes: [{id: 'a', label: '入口'}, {id: 'b', label: '出口'}], edges: [{from: 'a', to: 'b'}]}]};
const deck = (first: string) => ({title: '試験', slides: [{title: first, figure, notes: 'はじめのメモ\n  字下げ'}, {title: '2 枚目', lead: 'リード'}, {title: '3 枚目'}]});
fs.writeFileSync(path.join(proj, '.svg-diagram.json'), JSON.stringify({measure: 'font', fonts: JA_FONTS}));
fs.writeFileSync(deckFile, JSON.stringify(deck('1 枚目')));

const freePort = () => new Promise<number>(resolve => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });
const port = await freePort(), B = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.join(ROOT, 'serve-diagram.ts'), deckFile, '--port', String(port)], {cwd: proj, env: {...process.env, XDG_CONFIG_HOME: path.join(proj, 'config')}, stdio: ['ignore', 'pipe', 'pipe']});
let out = '';
child.stdout.on('data', (b: Buffer) => { out += b; });
child.stderr.on('data', (b: Buffer) => { out += b; });
test.after(() => { child.kill(); fs.rmSync(proj, {recursive: true, force: true}); });
await new Promise<void>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`serve did not start:\n${out}`)), 60_000);
  const check = setInterval(() => { if (out.includes('watching')) { clearTimeout(t); clearInterval(check); resolve(); } }, 50);
});
const token = /#token=([A-Za-z0-9_-]+)/.exec(out)?.[1] ?? '';

/** An event stream: every message so far, and a way to wait for the next one that matches. */
async function stream(cookie?: string) {
  const ac = new AbortController();
  const res = await fetch(`${B}/api/events`, {headers: {'sec-fetch-site': 'same-origin', ...(cookie ? {cookie} : {})}, signal: ac.signal});
  assert.equal(res.status, 200);
  const got: Record<string, unknown>[] = [], waiters: {pred: (m: Record<string, unknown>) => boolean; resolve: (m: Record<string, unknown>) => void}[] = [];
  void (async () => {
    let buf = '';
    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buf += Buffer.from(chunk).toString();
        for (let i = buf.indexOf('\n\n'); i >= 0; i = buf.indexOf('\n\n')) {
          const ev = buf.slice(0, i); buf = buf.slice(i + 2);
          const data = /^data: (.*)$/m.exec(ev)?.[1];
          if (!data) continue;
          const m = JSON.parse(data) as Record<string, unknown>;
          got.push(m);
          for (const w of waiters.splice(0)) if (w.pred(m)) w.resolve(m); else waiters.push(w);
        }
      }
    } catch { /* aborted */ }
  })();
  const next = (pred: (m: Record<string, unknown>) => boolean, ms = 30_000) => {
    const seen = got.find(pred);
    if (seen) { got.splice(got.indexOf(seen), 1); return Promise.resolve(seen); }
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('no such message')), ms);
      waiters.push({pred: m => { if (!pred(m)) return false; got.splice(got.indexOf(m), 1); return true; }, resolve: m => { clearTimeout(t); resolve(m); }});
    });
  };
  return {got, next, close: () => ac.abort()};
}
const post = (p: string, body: unknown, headers: Record<string, string> = {}) => fetch(B + p, {method: 'POST', headers: {origin: B, 'content-type': 'application/json', ...headers}, body: JSON.stringify(body)});

let cookie = '';
test('the pages: the viewer\'s and the presenter\'s, with a strict CSP; nothing else of the disk', async () => {
  for (const p of ['/', '/presenter']) {
    const r = await fetch(B + p);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-security-policy') ?? '', /script-src 'self'/);
    assert.match(await r.text(), /<script type="application\/json" id="sd-config">/);
  }
  for (const p of ['/deck.json', '/.svg-diagram.json', '/s/abc.svg']) assert.equal((await fetch(B + p)).status, 404, p);
  // (fetch will not send another Host)
  const status = await new Promise<number>(resolve => http.get({host: '127.0.0.1', port, path: '/', headers: {host: `evil.example:${port}`}}, r => { r.resume(); resolve(r.statusCode ?? 0); }));
  assert.equal(status, 403, 'another name for this machine');
});

test('the token is traded for a cookie only from this server\'s own page, and only the right one', async () => {
  assert.equal((await post('/claim', {token: 'wrong'})).status, 403, 'a wrong token');
  assert.equal((await post('/claim', {token}, {origin: 'http://localhost:1'})).status, 403, 'from another origin');
  const r = await post('/claim', {token});
  assert.equal(r.status, 204);
  const set = r.headers.get('set-cookie') ?? '';
  assert.match(set, new RegExp(`^sd-presenter-${port}=[^;]+; HttpOnly; SameSite=Strict; Path=/$`));
  cookie = set.split(';')[0] ?? '';
});

test('a presenter\'s go reaches every client; a viewer\'s is refused; the presenter alone gets the deck, the notes and the problems', async () => {
  const viewer = await stream(), presenter = await stream(cookie);
  assert.deepEqual(await viewer.next(m => m['type'] === 'hello'), {type: 'hello', role: 'viewer'});
  assert.deepEqual(await presenter.next(m => m['type'] === 'hello'), {type: 'hello', role: 'presenter'});
  const first = await viewer.next(m => m['type'] === 'state');
  assert.equal(first['index'], 0);
  assert.equal(first['total'], 3);
  const deckMsg = await presenter.next(m => m['type'] === 'deck');
  assert.equal((deckMsg['slides'] as unknown[]).length, 3);
  assert.equal(viewer.got.some(m => m['type'] === 'deck'), false, 'a viewer is not told the other slides');
  // the slide itself, with the headers that keep anything in it from running
  const svg = await fetch(B + String(first['slide']));
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get('content-security-policy') ?? '', /^sandbox;/);
  assert.equal(svg.headers.get('x-content-type-options'), 'nosniff');
  assert.doesNotMatch(await svg.text(), /<text\b/);

  assert.equal((await post('/api/go', {type: 'go', delta: 1})).status, 403, 'a viewer');
  assert.equal((await post('/api/go', {type: 'go', delta: 1}, {cookie: 'sd-presenter-' + port + '=forged'})).status, 403, 'a forged cookie');
  assert.equal((await post('/api/go', {type: 'go', delta: 1}, {cookie})).status, 204);
  assert.equal((await post('/api/go', {type: 'go', delta: 1}, {cookie})).status, 204);
  const moved = await viewer.next(m => m['type'] === 'state' && m['index'] === 2);
  assert.equal(moved['epoch'], first['epoch']);
  assert.equal(moved['seq'], Number(first['seq']) + 2, 'two quick presses, two slides');
  await presenter.next(m => m['type'] === 'state' && m['index'] === 2);

  assert.equal((await fetch(B + '/api/notes')).status, 403);
  const notes = await fetch(B + '/api/notes', {headers: {cookie}});
  assert.equal(notes.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(((await notes.json()) as {notes: string[]}).notes, ['はじめのメモ\n  字下げ', '', '']);
  assert.equal((await fetch(B + '/print')).status, 403);
  assert.equal((await fetch(B + '/print', {headers: {cookie}})).status, 200);
  const pptx = await fetch(B + '/deck.pptx', {headers: {cookie}});
  assert.equal(pptx.status, 200);
  assert.equal(pptx.headers.get('content-disposition'), `attachment; filename="deck.pptx"; filename*=UTF-8''deck.pptx`);
  assert.ok((await pptx.arrayBuffer()).byteLength > 1000);
  viewer.close(); presenter.close();
});

test('saving the deck draws it again: the current slide follows its content, an old slide is gone, a broken deck keeps the last good one', async () => {
  const viewer = await stream(), presenter = await stream(cookie);
  const now = await viewer.next(m => m['type'] === 'state');
  const oldFirst = ((await presenter.next(m => m['type'] === 'deck'))['slides'] as {url: string}[])[0]?.url ?? '';
  // a slide added before the current one (the third): the viewer stays on the same content
  const d = deck('1 枚目 (直した)');
  d.slides.splice(0, 0, {title: '差し込み', figure} as (typeof d.slides)[number]);
  fs.writeFileSync(deckFile, JSON.stringify(d));
  const after = await viewer.next(m => m['type'] === 'state' && Number(m['version']) > Number(now['version']));
  assert.equal(after['index'], 3);
  assert.ok(Number(after['seq']) > Number(now['seq']), 'a new deck is a new state: a page holding the old one takes it');
  assert.equal(after['slide'], now['slide']);
  assert.equal(after['total'], 4);
  assert.equal((await fetch(B + oldFirst)).status, 404, 'the slide before the edit');
  // a broken deck: the presenter is told where, the viewer is not, and the slides stay
  fs.writeFileSync(deckFile, '{"slides": [');
  const problems = await presenter.next(m => m['type'] === 'problems' && (m['errors'] as string[]).length > 0);
  assert.match((problems['errors'] as string[])[0] ?? '', /deck\.json/);
  assert.equal(viewer.got.some(m => m['type'] === 'problems'), false);
  assert.equal((await fetch(B + String(after['slide']))).status, 200);
  fs.writeFileSync(deckFile, JSON.stringify(d));
  await presenter.next(m => m['type'] === 'problems' && (m['errors'] as string[]).length === 0);
  viewer.close(); presenter.close();
});

test('a change to the notes alone reaches the presenter, and the slides stay as they are', async () => {
  const presenter = await stream(cookie);
  const before = await presenter.next(m => m['type'] === 'state');
  await presenter.next(m => m['type'] === 'deck');
  const d = JSON.parse(fs.readFileSync(deckFile, 'utf8')) as {slides: {notes?: string}[]};
  (d.slides[0] as {notes?: string}).notes = '直したメモ';
  fs.writeFileSync(deckFile, JSON.stringify(d));
  const again = await presenter.next(m => m['type'] === 'deck');
  assert.equal(again['version'], before['version'], 'no new version: the slides did not change');
  const notes = await fetch(B + '/api/notes', {headers: {cookie}});
  assert.equal(((await notes.json()) as {notes: string[]}).notes[0], '直したメモ');
  presenter.close();
});
