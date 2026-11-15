// ADR 0056 D11-D17: the Worker in workerd (`wrangler dev`), with Google and Access faked on this machine. Publishing (the hashes first, then
// only the missing SVGs; the allowlist, the limits), the pages, following the presenter over WebSockets, the presenter's token, sign-in by
// Google and by Access, revoking, deleting, the settings check, and hibernation.
import {after, before, describe, test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MAX_SLIDES} from '../../lib/deck-spec.ts';
import {CORE_MAX_SLIDES} from '../src/config.ts';
import {fakeAccess, fakeGoogle, PUBLISH_TOKEN, SESSION_SECRET, sha256, slideSvg, socket, startWorker, type Running} from './helpers.ts';

const SECRETS = {PUBLISH_TOKEN, SESSION_SECRET};
const auth = {authorization: `Bearer ${PUBLISH_TOKEN}`};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** A presentation made and published with `n` slides; its id and first presenter token. */
async function published(origin: string, n = 3, extra: Record<string, string> = {}): Promise<{id: string; token: string; slides: {svg: string; hash: string}[]}> {
  const made = await fetch(`${origin}/api/p`, {method: 'POST', headers: auth});
  assert.equal(made.status, 201);
  const {id, presenterToken} = await made.json() as {id: string; presenterToken: string};
  const slides = Array.from({length: n}, (_, i) => { const svg = slideSvg(i + 1); return {svg, hash: sha256(svg)}; });
  const meta = slides.map((s, i) => ({hash: s.hash, title: `スライド ${i + 1}`, text: `スライド ${i + 1}`, notes: `メモ ${i + 1}`, bytes: s.svg.length}));
  const first = await fetch(`${origin}/api/p/${id}`, {method: 'PUT', headers: {...auth, 'content-type': 'application/json'}, body: JSON.stringify({title: '試験', slides: meta, svgs: {}})});
  assert.equal(first.status, 409, 'the Worker asks for the SVGs it does not hold');
  assert.deepEqual(new Set(((await first.json()) as {need: string[]}).need), new Set(slides.map(s => s.hash)));
  const second = await fetch(`${origin}/api/p/${id}`, {method: 'PUT', headers: {...auth, 'content-type': 'application/json', ...extra}, body: JSON.stringify({title: '試験', slides: meta, svgs: Object.fromEntries(slides.map(s => [s.hash, s.svg]))})});
  assert.equal(second.status, 200, await second.clone().text());
  return {id, token: presenterToken, slides};
}

/** The presenter's cookie for `token`, traded as the presenter's page trades it. */
async function claim(origin: string, id: string, token: string): Promise<string> {
  const r = await fetch(`${origin}/p/${id}/t`, {method: 'POST', headers: {origin, 'content-type': 'application/json'}, body: JSON.stringify({token})});
  assert.equal(r.status, 204);
  const set = r.headers.get('set-cookie') ?? '';
  assert.match(set, new RegExp(`^__Host-p-${id}=[^;]+; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Lax$`));
  return set.split(';')[0] ?? '';
}

test('the Worker\'s MAX_SLIDES ceiling is core\'s', () => assert.equal(CORE_MAX_SLIDES, MAX_SLIDES));

describe('presenter by token (PRESENTER_LOGIN none)', () => {
  let w: Running;
  before(async () => { w = await startWorker({...SECRETS, MAX_SLIDES: '5', MAX_SLIDE_BYTES: '20000', MAX_DECK_BYTES: '40000', MAX_CONNECTIONS: '6'}); });
  after(() => w.stop());

  test('publishing needs PUBLISH_TOKEN; /api/version says the protocol, and the limits only to the publisher', async () => {
    assert.deepEqual(await (await fetch(`${w.origin}/api/version`)).json(), {protocol: 2});
    assert.deepEqual(await (await fetch(`${w.origin}/api/version`, {headers: auth})).json(), {protocol: 2, limits: {maxSlides: 5, maxSlideBytes: 20000, maxDeckBytes: 40000}, login: 'none'});
    assert.equal((await fetch(`${w.origin}/api/p`, {method: 'POST'})).status, 401);
    assert.equal((await fetch(`${w.origin}/api/p`, {method: 'POST', headers: {authorization: 'Bearer wrong'}})).status, 401);
  });

  test('what is sent is checked: the allowlist, the hash, the limits; a refused deck leaves the last one', async () => {
    const {id, slides} = await published(w.origin);
    const put = (body: unknown) => fetch(`${w.origin}/api/p/${id}`, {method: 'PUT', headers: {...auth, 'content-type': 'application/json'}, body: JSON.stringify(body)});
    const evil = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', eh = sha256(evil);
    const r1 = await put({title: 'x', slides: [{hash: eh, title: '', text: '', notes: '', bytes: evil.length}], svgs: {[eh]: evil}});
    assert.equal(r1.status, 422);
    assert.match(JSON.stringify(await r1.json()), /slides\[0\].*script/);
    const r2 = await put({title: 'x', slides: [{hash: 'f'.repeat(64), title: '', text: '', notes: '', bytes: 1}], svgs: {['f'.repeat(64)]: slideSvg(99)}});
    assert.equal(r2.status, 422, 'an SVG that does not match its hash');
    const big = slideSvg(1).replace('</svg>', `<rect width="1" height="1" fill="#000000" id="${'a'.repeat(21000)}"/></svg>`), bh = sha256(big);
    assert.equal((await put({title: 'x', slides: [{hash: bh, title: '', text: '', notes: '', bytes: big.length}], svgs: {[bh]: big}})).status, 413, 'over MAX_SLIDE_BYTES');
    // three slides of 15000 bytes: each within MAX_SLIDE_BYTES (20000), the count within MAX_SLIDES (5), together over MAX_DECK_BYTES (40000)
    const heavy = [1, 2, 3].map(n => slideSvg(n).replace('</svg>', `<rect width="1" height="1" fill="#000000" id="${'b'.repeat(15000)}"/></svg>`));
    const r3 = await put({title: 'x', slides: heavy.map(svg => ({hash: sha256(svg), title: '', text: '', notes: '', bytes: svg.length})), svgs: Object.fromEntries(heavy.map(svg => [sha256(svg), svg]))});
    assert.equal(r3.status, 413, 'over MAX_DECK_BYTES');
    assert.match(JSON.stringify(await r3.json()), /MAX_DECK_BYTES\), whatever the number of slides/);
    const six = Array.from({length: 6}, () => ({hash: slides[0]?.hash, title: '', text: '', notes: '', bytes: 1}));
    assert.equal((await put({title: 'x', slides: six, svgs: {}})).status, 413, 'over MAX_SLIDES');
    // the deck before is still there
    assert.equal((await fetch(`${w.origin}/p/${id}/s/${slides[0]?.hash}.svg`)).status, 200);
  });

  test('the pages and the slides: only the current deck\'s SVGs, with the headers that keep them inert; nothing else answers', async () => {
    const {id, slides} = await published(w.origin);
    const page = await fetch(`${w.origin}/p/${id}`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /script-src 'self'/);
    assert.equal(page.headers.get('x-robots-tag'), 'noindex');
    const svg = await fetch(`${w.origin}/p/${id}/s/${slides[1]?.hash}.svg`);
    assert.match(svg.headers.get('content-security-policy') ?? '', /^sandbox;/);
    assert.equal(svg.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await fetch(`${w.origin}/p/${id}/s/${'0'.repeat(64)}.svg`)).status, 404);
    // an id this namespace never made: 404 without waking anything
    assert.equal((await fetch(`${w.origin}/p/${'ab'.repeat(32)}`)).status, 404);
    for (const p of ['/', '/p', `/p/${id}/x`, '/api/p/zz', '/wrangler.jsonc']) assert.equal((await fetch(w.origin + p)).status, p.startsWith('/api') ? 401 : 404, p);
    assert.equal((await fetch(`${w.origin}/p/${id}/notes`)).status, 403, 'the notes are the presenter\'s');
    assert.equal((await fetch(`${w.origin}/p/${id}/print`)).status, 200, 'every slide is the viewers\' too (ADR 0062)');
    assert.equal((await fetch(`${w.origin}/p/${id}/login`)).status, 404, 'no email sign-in set up');
  });

  test('a presenter\'s go moves every device; a viewer\'s is dropped; quick presses all count; WebSockets need this origin', async () => {
    const {id, token} = await published(w.origin);
    const cookie = await claim(w.origin, id, token);
    assert.equal((await fetch(`${w.origin}/p/${id}/t`, {method: 'POST', headers: {origin: w.origin}, body: '{"token":"wrong"}'})).status, 403);
    assert.equal((await fetch(`${w.origin}/p/${id}/t`, {method: 'POST', headers: {origin: 'https://evil.example'}, body: JSON.stringify({token})})).status, 403);
    const viewer = await socket(w.origin, id), presenter = await socket(w.origin, id, {origin: w.origin, cookie});
    assert.deepEqual(await viewer.next(m => m['type'] === 'hello'), {type: 'hello', role: 'viewer'});
    assert.deepEqual(await presenter.next(m => m['type'] === 'hello'), {type: 'hello', role: 'presenter'});
    assert.equal((await presenter.next(m => m['type'] === 'deck'))['slides'] instanceof Array, true);
    const s0 = await viewer.next(m => m['type'] === 'state');
    viewer.send({type: 'go', delta: 1});
    // a forged role header from the device is taken out by the Worker
    const forged = await socket(w.origin, id, {origin: w.origin, 'x-sd-role': 'presenter'});
    assert.deepEqual(await forged.next(m => m['type'] === 'hello'), {type: 'hello', role: 'viewer'});
    forged.send({type: 'go', delta: 1});
    await sleep(300);
    assert.equal(viewer.got.filter(m => m['type'] === 'state').length, 0, 'nothing moved');
    presenter.send({type: 'go', delta: 1}); presenter.send({type: 'go', delta: 1});
    const moved = await viewer.next(m => m['type'] === 'state' && m['index'] === 2);
    assert.equal(moved['seq'], Number(s0['seq']) + 2);
    assert.match(String(moved['slide']), new RegExp(`^/p/${id}/s/[0-9a-f]{64}\\.svg$`));
    assert.ok(viewer.got.some(m => m['type'] === 'deck') || (await viewer.next(m => m['type'] === 'deck')), 'a viewer is told every slide (ADR 0062)');
    await assert.rejects(socket(w.origin, id, {origin: 'https://evil.example'}), 'another site');
    await assert.rejects(socket(w.origin, id, {}), 'no Origin: not a browser page');
    const notes = await fetch(`${w.origin}/p/${id}/notes`, {headers: {cookie}});
    assert.deepEqual(await notes.json(), {version: 1, notes: ['メモ 1', 'メモ 2', 'メモ 3']});
    assert.equal(notes.headers.get('cache-control'), 'private, no-store');
    viewer.ws.close(); presenter.ws.close(); forged.ws.close();
  });

  test('ADR 0062: the presenter links and unlinks, and the laser pointer reaches every viewer; a viewer\'s are dropped', async () => {
    const {id, token} = await published(w.origin);
    const cookie = await claim(w.origin, id, token);
    const viewer = await socket(w.origin, id), presenter = await socket(w.origin, id, {origin: w.origin, cookie});
    assert.equal((await viewer.next(m => m['type'] === 'state'))['linked'], true);
    await viewer.next(m => m['type'] === 'deck');
    viewer.send({type: 'link', on: false});
    viewer.send({type: 'pointer', index: 0, x: 0.5, y: 0.5});
    presenter.send({type: 'link', on: false});
    assert.equal((await viewer.next(m => m['type'] === 'state'))['linked'], false);
    presenter.send({type: 'pointer', index: 0, x: 0.25, y: 0.75});
    assert.deepEqual(await viewer.next(m => m['type'] === 'pointer'), {type: 'pointer', index: 0, x: 0.25, y: 0.75});
    assert.equal(viewer.got.filter(m => m['type'] === 'pointer').length, 0, 'the viewer\'s own pointer was dropped');
    presenter.send({type: 'zoom', index: 0, z: 2, x: 0.5, y: 0.5});
    assert.deepEqual(await viewer.next(m => m['type'] === 'zoom'), {type: 'zoom', index: 0, z: 2, x: 0.5, y: 0.5}, 'the presenter\'s zoom (ADR 0063)');
    viewer.ws.close(); presenter.ws.close();
  });

  test('publishing again: the current slide follows its content, a slide no longer in the deck is gone, devices are told', async () => {
    const {id, token, slides} = await published(w.origin);
    const cookie = await claim(w.origin, id, token);
    const viewer = await socket(w.origin, id), presenter = await socket(w.origin, id, {origin: w.origin, cookie});
    presenter.send({type: 'go', index: 1});
    await viewer.next(m => m['type'] === 'state' && m['index'] === 1);
    const added = slideSvg(50), ah = sha256(added);
    const meta = [{hash: ah, title: '新しい 1 枚目', text: '', notes: '', bytes: added.length}, ...slides.slice(1).map((s, i) => ({hash: s.hash, title: `スライド ${i + 2}`, text: '', notes: '', bytes: s.svg.length}))];
    const r = await fetch(`${w.origin}/api/p/${id}`, {method: 'PUT', headers: {...auth, 'content-type': 'application/json'}, body: JSON.stringify({title: '試験', slides: [meta[0], ...meta], svgs: {[ah]: added}})});
    assert.equal(r.status, 200);
    const after = await viewer.next(m => m['type'] === 'state' && m['version'] === 2);
    assert.equal(after['index'], 2, 'two slides before it now (the first replaced, one added)');
    assert.equal((await fetch(`${w.origin}/p/${id}/s/${slides[0]?.hash}.svg`)).status, 404, 'the slide taken out');
    await presenter.next(m => m['type'] === 'deck' && m['version'] === 2);
    viewer.ws.close(); presenter.ws.close();
  });

  test('revoking the tokens disconnects a presenter who came in by one, and their cookie stops working; a new token works', async () => {
    const {id, token} = await published(w.origin);
    const cookie = await claim(w.origin, id, token);
    const presenter = await socket(w.origin, id, {origin: w.origin, cookie});
    await presenter.next(m => m['type'] === 'hello');
    assert.equal((await fetch(`${w.origin}/api/p/${id}/tokens`, {method: 'DELETE', headers: auth})).status, 204);
    for (let i = 0; i < 40 && !presenter.ending(); i++) await sleep(50);
    assert.ok(presenter.ending(), 'the server closed it');
    assert.equal((await fetch(`${w.origin}/p/${id}/notes`, {headers: {cookie}})).status, 403);
    const again = await socket(w.origin, id, {origin: w.origin, cookie});
    assert.deepEqual(await again.next(m => m['type'] === 'hello'), {type: 'hello', role: 'viewer'});
    again.ws.close();
    const fresh = ((await (await fetch(`${w.origin}/api/p/${id}/tokens`, {method: 'POST', headers: auth})).json()) as {presenterToken: string}).presenterToken;
    assert.equal((await fetch(`${w.origin}/p/${id}/notes`, {headers: {cookie: await claim(w.origin, id, fresh)}})).status, 200);
  });

  test('MAX_CONNECTIONS: the next device is told the presentation is full', async () => {
    const {id} = await published(w.origin);
    const open = [];
    for (let i = 0; i < 6; i++) open.push(await socket(w.origin, id));
    await assert.rejects(socket(w.origin, id));
    // the presenter still gets in: viewers cannot lock them out
    const fresh = ((await (await fetch(`${w.origin}/api/p/${id}/tokens`, {method: 'POST', headers: auth})).json()) as {presenterToken: string}).presenterToken;
    const presenter = await socket(w.origin, id, {origin: w.origin, cookie: await claim(w.origin, id, fresh)});
    assert.deepEqual(await presenter.next(m => m['type'] === 'hello'), {type: 'hello', role: 'presenter'});
    presenter.ws.close();
    for (const s of open) s.ws.close();
  });

  test('deleting: every URL of it answers 404, and its devices are disconnected', async () => {
    const {id, slides} = await published(w.origin);
    const viewer = await socket(w.origin, id);
    await viewer.next(m => m['type'] === 'state');
    assert.equal((await fetch(`${w.origin}/api/p/${id}`, {method: 'DELETE', headers: auth})).status, 204);
    for (let i = 0; i < 40 && !viewer.ending(); i++) await sleep(50);
    assert.ok(viewer.ending(), 'the server closed it');
    for (const p of ['', '/presenter', `/s/${slides[0]?.hash}.svg`]) assert.equal((await fetch(`${w.origin}/p/${id}${p}`)).status, 404, p);
    assert.equal((await fetch(`${w.origin}/api/p/${id}`, {method: 'DELETE', headers: auth})).status, 404);
  });
});

describe('the settings are checked', () => {
  test('a Worker missing a setting answers no one: an empty 503, and what is missing only to the publisher', async () => {
    const w = await startWorker({PUBLISH_TOKEN, SESSION_SECRET, PRESENTER_LOGIN: 'google', PRESENTER_EMAILS: 'a@example.com'});
    try {
      const viewer = await fetch(`${w.origin}/p/${'ab'.repeat(32)}`);
      assert.equal(viewer.status, 503);
      assert.equal(await viewer.text(), '');
      const pub = await fetch(`${w.origin}/api/version`, {headers: auth});
      assert.equal(pub.status, 503);
      assert.match(JSON.stringify(await pub.json()), /GOOGLE_CLIENT_ID/);
    } finally { await w.stop(); }
  });
});

describe('presenter by Google (fake)', () => {
  let w: Running, g: Awaited<ReturnType<typeof fakeGoogle>>, persist: string;
  const vars = (emails: string) => ({...SECRETS, PRESENTER_LOGIN: 'google', PRESENTER_EMAILS: emails, GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs', GOOGLE_HD: 'example.com',
    GOOGLE_AUTH_URL: `${g.url}/authorize`, GOOGLE_TOKEN_URL: `${g.url}/token`});
  before(async () => { g = await fakeGoogle(); persist = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-worker-g-')); w = await startWorker(vars('Alice@Example.com, carol@example.com'), persist); });
  after(async () => { await w.stop(); g.close(); });

  /** The sign-in walked as a browser walks it: the redirects followed, the cookies carried. */
  async function signIn(id: string): Promise<{status: number; cookie: string; location: string}> {
    const start = await fetch(`${w.origin}/p/${id}/login`, {redirect: 'manual'});
    const oidc = (start.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const atGoogle = await fetch(start.headers.get('location') ?? '', {redirect: 'manual'});
    const back = await fetch(atGoogle.headers.get('location') ?? '', {redirect: 'manual', headers: {cookie: oidc}});
    const cookie = (back.headers.getSetCookie().find(c => c.startsWith('__Host-p-')) ?? '').split(';')[0] ?? '';
    return {status: back.status, cookie, location: back.headers.get('location') ?? ''};
  }

  test('a listed, verified address of the organisation signs in (the list ignores case) and presents', async () => {
    const {id} = await published(w.origin);
    Object.assign(g.claims, {email: 'alice@example.com', email_verified: true, hd: 'example.com'});
    const r = await signIn(id);
    assert.equal(r.status, 302);
    assert.equal(r.location, `/p/${id}/presenter`);
    assert.equal((await fetch(`${w.origin}/p/${id}/notes`, {headers: {cookie: r.cookie}})).status, 200);
    const presenter = await socket(w.origin, id, {origin: w.origin, cookie: r.cookie});
    assert.deepEqual(await presenter.next(m => m['type'] === 'hello'), {type: 'hello', role: 'presenter'});
    presenter.ws.close();
  });

  test('an unverified address, another organisation, an address not listed, a callback without the sign-in cookie: refused', async () => {
    const {id} = await published(w.origin);
    for (const [claims, status] of [[{email_verified: false}, 403], [{hd: 'other.example'}, 403], [{email: 'mallory@example.com'}, 403]] as const) {
      Object.assign(g.claims, {email: 'alice@example.com', email_verified: true, hd: 'example.com'}, claims);
      const r = await signIn(id);
      assert.equal(r.status, status, JSON.stringify(claims));
      assert.equal(r.cookie, '');
    }
    assert.equal((await fetch(`${w.origin}/auth/google/callback?code=x&state=y`)).status, 400);
  });

  test('an address taken off PRESENTER_EMAILS stops presenting, with the cookie it already has', async () => {
    const {id} = await published(w.origin);
    Object.assign(g.claims, {email: 'carol@example.com', email_verified: true, hd: 'example.com'});
    const r = await signIn(id);
    assert.equal((await fetch(`${w.origin}/p/${id}/notes`, {headers: {cookie: r.cookie}})).status, 200);
    await w.stop();
    w = await startWorker(vars('alice@example.com'), persist);
    assert.equal((await fetch(`${w.origin}/p/${id}/notes`, {headers: {cookie: r.cookie}})).status, 403);
  });
});

describe('presenter by Cloudflare Access (fake)', () => {
  let w: Running, a: Awaited<ReturnType<typeof fakeAccess>>;
  before(async () => {
    a = await fakeAccess('AUD123');
    w = await startWorker({...SECRETS, PRESENTER_LOGIN: 'access', PRESENTER_EMAILS: 'bob@example.com', ACCESS_AUD: 'AUD123', ACCESS_CERTS_URL: `${a.url}/cdn-cgi/access/certs`, ACCESS_ISS: a.iss});
  });
  after(async () => { await w.stop(); a.close(); });

  test('a valid JWT of a listed address signs in; every broken one, and the address header alone, is refused', async () => {
    const {id} = await published(w.origin);
    const login = (h: Record<string, string>) => fetch(`${w.origin}/p/${id}/login`, {redirect: 'manual', headers: h});
    const ok = await login({'cf-access-jwt-assertion': a.jwt()});
    assert.equal(ok.status, 302);
    const cookie = (ok.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    assert.equal((await fetch(`${w.origin}/p/${id}/notes`, {headers: {cookie}})).status, 200);
    for (const kind of ['aud', 'iss', 'expired', 'noemail', 'sig', 'kid']) assert.equal((await login({'cf-access-jwt-assertion': a.jwt(kind)})).status, 403, kind);
    assert.equal((await login({'cf-access-jwt-assertion': a.jwt('ok', 'mallory@example.com')})).status, 403, 'not listed');
    assert.equal((await login({'cf-access-authenticated-user-email': 'bob@example.com'})).status, 403, 'the header alone');
    // the token's way in is not behind Access, and still works
    const other = await published(w.origin);
    assert.equal((await fetch(`${w.origin}/p/${other.id}/notes`, {headers: {cookie: await claim(w.origin, other.id, other.token)}})).status, 200);
  });
});

describe('hibernation (workerd evicts an idle Durable Object, the WebSockets stay)', () => {
  let w: Running;
  before(async () => { w = await startWorker(SECRETS); });
  after(() => w.stop());

  test('after 15 s idle the presenter still moves every device, from the stored state', async () => {
    const {id, token} = await published(w.origin);
    const cookie = await claim(w.origin, id, token);
    const viewer = await socket(w.origin, id), presenter = await socket(w.origin, id, {origin: w.origin, cookie});
    presenter.send({type: 'go', index: 1});
    await viewer.next(m => m['type'] === 'state' && m['index'] === 1);
    await sleep(15_000);
    assert.equal(viewer.closed(), null);
    presenter.send({type: 'go', delta: 1});
    const s = await viewer.next(m => m['type'] === 'state' && m['index'] === 2);
    assert.equal(s['index'], 2);
    viewer.ws.close(); presenter.ws.close();
  });
});
