#!/usr/bin/env node
// svg-diagram serve <deck.json> [--port N] [--host ADDR] [--allow-host NAME]... [--open]
// svg-diagram serve <deck.json> --publish [ORIGIN] [--new-presenter-token | --revoke-presenter-tokens | --delete]
// A deck (ADR 0055) shown in the browser and followed by every connected device (ADR 0056): the slides are outlined SVGs drawn again when
// a file they come from is saved; the presenter's page moves every page; a viewer's page cannot move. The presenter is whoever opened the
// presenter's URL with its token. With --publish the slides go to the presenter's own Worker (worker/, ADR 0056 D11-D16) instead of a
// server here: ORIGIN (or SVG_DIAGRAM_PUBLISH_ORIGIN) is the Worker, SVG_DIAGRAM_PUBLISH_TOKEN its PUBLISH_TOKEN.
import { createHash, randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { loadConfig } from './lib/config.js';
import { outlineFontCheck } from './lib/font-metrics.js';
import { currentMeasure, configureMeasure } from './lib/measure.js';
import { allowGo, applyGo, followIndex, parsePresenter, POINTER_PER_SECOND } from './lib/present/sync.js';
import { allowedHosts, cookieValue, hostOk, PAGE_HEADERS, postOk, sameSecret, streamOk, SVG_HEADERS } from './lib/present/guard.js';
import { ASSET_CSS, ASSET_JS, PRESENT_CSS, PRESENT_JS, presenterPage, printPage, viewerPage } from './lib/present/ui.js';
import { qrSvg, qrTerminal } from './lib/present/qr.js';
import { deletePresentation, ensurePresentation, newPresenterToken, overLimits, presenterUrlOf, PublishError, pushSlides, readRecord, revokePresenterTokens, viewerUrlOf, workerLimits } from './lib/present/publish.js';
const USAGE = 'Usage: svg-diagram serve <deck.json> [--port N] [--host ADDR] [--allow-host NAME]... [--open]\n       svg-diagram serve <deck.json> --publish [ORIGIN] [--new-presenter-token | --revoke-presenter-tokens | --delete]';
const args = process.argv.slice(2), values = ['--port', '--host', '--allow-host'];
const flags = ['--open', '--publish', '--new-presenter-token', '--revoke-presenter-tokens', '--delete'];
const usage = (message) => { console.error(message ? `✗ ${message}\n${USAGE}` : USAGE); process.exit(2); };
for (const [i, arg] of args.entries()) {
    if (arg.startsWith('--') && !values.includes(arg) && !flags.includes(arg))
        usage(`unknown option ${arg}`);
    if (values.includes(arg) && (args[i + 1] === undefined || args[i + 1]?.startsWith('--')))
        usage(`${arg} needs a value`);
}
const value = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const all = (name) => args.flatMap((a, i) => a === name && args[i + 1] !== undefined ? [args[i + 1]] : []);
// --publish takes the Worker's origin as its value when one follows it
const publishing = args.includes('--publish');
const publishArg = publishing && /^https?:\/\//.test(args[args.indexOf('--publish') + 1] ?? '') ? args[args.indexOf('--publish') + 1] : undefined;
const files = args.filter((arg, i) => !arg.startsWith('--') && !values.includes(args[i - 1] ?? '') && arg !== publishArg);
if (files.length !== 1 || !files[0]?.endsWith('.json'))
    usage('serve takes one deck .json file');
const deckFile = path.resolve(files[0]);
if (!fs.existsSync(deckFile))
    usage(`${files[0]} does not exist`);
const actions = ['--new-presenter-token', '--revoke-presenter-tokens', '--delete'].filter(a => args.includes(a));
if (actions.length && !publishing)
    usage(`${actions[0]} goes with --publish`);
if (actions.length > 1)
    usage(`${actions.join(' and ')}: one at a time`);
if (publishing && ['--port', '--host', '--allow-host', '--open'].some(a => args.includes(a)))
    usage('--publish starts no server here: --port, --host, --allow-host and --open do not go with it');
const portText = value('--port'), firstPort = portText === undefined ? 3030 : Number(portText);
if (!(Number.isInteger(firstPort) && firstPort > 0 && firstPort < 65536))
    usage(`--port needs a port number (got ${portText})`);
const host = value('--host') ?? '127.0.0.1';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
let target = null;
if (publishing) {
    const origin = publishArg ?? process.env['SVG_DIAGRAM_PUBLISH_ORIGIN'], token = process.env['SVG_DIAGRAM_PUBLISH_TOKEN'];
    if (!origin)
        usage('--publish needs the Worker: --publish https://… or SVG_DIAGRAM_PUBLISH_ORIGIN');
    if (!token)
        usage('--publish needs SVG_DIAGRAM_PUBLISH_TOKEN (the Worker\'s secret PUBLISH_TOKEN)');
    let o;
    try {
        o = new URL(origin);
    }
    catch {
        o = usage(`not a URL: ${origin}`);
    }
    if (o.protocol !== 'https:' && !LOOPBACK.has(o.hostname.replace(/^\[|\]$/g, '')))
        usage('the Worker must be https (http only for a Worker on this machine)');
    target = { origin: o.origin, token: token, deckFile };
}
/** The one-off actions on a published presentation. */
async function publishAction(t, action) {
    try {
        if (action === '--delete') {
            console.log(await deletePresentation(t) ? 'deleted: its URL answers 404 from now on' : 'nothing published to this Worker from this deck');
            return;
        }
        if (action === '--revoke-presenter-tokens') {
            await revokePresenterTokens(t);
            console.log('every presenter token is revoked, and the presenters signed in by one are disconnected');
            return;
        }
        const token = await newPresenterToken(t), record = readRecord(t);
        console.log(`presenter:  ${presenterUrlOf(record, token)}   (keep this one to yourself)`);
    }
    catch (e) {
        console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
    }
}
if (target && actions[0]) {
    await publishAction(target, actions[0]);
    process.exit(0);
}
// the outlines need the font files themselves: without one a slide would draw empty boxes, so stop now and say which (ADR 0056 D2)
const cfg = loadConfig(path.dirname(deckFile));
const fonts = outlineFontCheck(cfg.fonts);
if (!fonts.ok) {
    console.error(`✗ the slides are drawn with the text outlined, from the font files, and these are missing: ${fonts.missing.join(', ')}`);
    console.error('  name them in .svg-diagram.json: {"fonts": {"sans": {"regular": "/path/NotoSansJP-Regular.otf", "bold": "/path/NotoSansJP-Bold.otf"}}}');
    process.exit(1);
}
configureMeasure(cfg);
if (currentMeasure().backend === 'chromium')
    console.error('⚠ this project measures text with Chromium: the outlines come from the font files, which may not be the fonts it measured with');
// --- the deck, drawn in a thread that is replaced every RENEW drawings (ADR 0056 D5) -----------------------------------------------
const RENEW = 50, DRAW_TIMEOUT_MS = 120_000;
let thread = null, drawnInThread = 0;
function draw() {
    if (!thread || drawnInThread >= RENEW) {
        void thread?.terminate();
        thread = new Worker(new URL(import.meta.url.endsWith('.ts') ? './lib/present/render-thread.ts' : './lib/present/render-thread.js', import.meta.url));
        thread.unref();
        drawnInThread = 0;
    }
    const t = thread, req = { deckFile, fresh: drawnInThread > 0 };
    drawnInThread++;
    return new Promise((resolve, reject) => {
        // a figure that exits the process or never returns must not stop the drawing for the rest of the session: the thread goes, a new one comes
        const timer = setTimeout(() => fail(new Error(`drawing took over ${DRAW_TIMEOUT_MS / 1000} s: stopped (a figure that never returns?)`)), DRAW_TIMEOUT_MS);
        const off = () => { clearTimeout(timer); t.off('message', done); t.off('error', fail); t.off('exit', exited); };
        const done = (m) => { off(); resolve(m); };
        const fail = (e) => { off(); if (thread === t)
            thread = null; void t.terminate(); reject(e); };
        const exited = (code) => fail(new Error(`the drawing stopped (exit code ${code}): does a figure call process.exit()?`));
        t.on('message', done);
        t.on('error', fail);
        t.on('exit', exited);
        t.postMessage(req);
    });
}
let deck = null, slides = [], byHash = new Map();
let problems = { errors: [], warnings: [] };
const state = { epoch: randomBytes(8).toString('hex'), seq: 0, index: 0, version: 0 };
let moved = false, linked = true;
const clients = new Set();
const sendTo = (c, m) => { c.res.write(`data: ${JSON.stringify(m)}\n\n`); };
const slideUrl = (s) => `/s/${s.hash}.svg`;
function stateMessage() {
    const s = slides[state.index];
    return { type: 'state', ...state, slide: s ? slideUrl(s) : '', alt: s?.text ?? '', total: slides.length, moved, linked };
}
const deckMessage = () => ({ type: 'deck', version: state.version, slides: slides.map(s => ({ url: slideUrl(s), title: s.title, text: s.text })) });
const viewers = () => [...clients].filter(c => !c.presenter).length;
function broadcastState() { const m = stateMessage(); for (const c of clients)
    sendTo(c, m); }
function toPresenters(m) { for (const c of clients)
    if (c.presenter)
        sendTo(c, m); }
function toAll(m) { for (const c of clients)
    sendTo(c, m); }
const countMessage = () => ({ type: 'count', viewers: viewers() });
// --- drawing again when a file changes ------------------------------------------------------------------------------------
let watched = new Map(), watchedFiles = new Set();
let drawing = false, again = false, timer = null;
function watch(list) {
    watchedFiles = new Set(list.map(f => path.resolve(f)));
    // the folders, not the files: an editor that saves by renaming a new file over the old one would leave a file watch behind
    const dirs = new Set([...watchedFiles].map(f => path.dirname(f)).filter(d => fs.existsSync(d)));
    for (const [d, w] of watched)
        if (!dirs.has(d)) {
            w.close();
            watched.delete(d);
        }
    for (const d of dirs) {
        if (watched.has(d))
            continue;
        try {
            watched.set(d, fs.watch(d, (_e, name) => { if (name && watchedFiles.has(path.join(d, name.toString())))
                schedule(); }));
        }
        catch { /* a folder that cannot be watched: its files are not followed */ }
    }
}
function schedule() {
    if (timer)
        clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void redraw(); }, 100);
}
async function redraw() {
    if (drawing) {
        again = true;
        return;
    }
    drawing = true;
    const t0 = Date.now();
    try {
        const r = await draw();
        watch(r.files);
        const errors = [...r.errors, ...(r.deck?.errors ?? [])], warnings = r.deck?.warnings ?? [];
        const complete = r.deck && !errors.length && r.deck.slides.every(s => s !== null);
        if (complete && r.deck) {
            const next = r.deck.slides;
            const changed = next.length !== slides.length || next.some((s, i) => s.hash !== slides[i]?.hash);
            deck = r.deck;
            // the notes are not in the picture: a change to them alone goes to the presenters (their page reads the notes again)
            const notesChanged = !changed && next.some((s, i) => s.notes !== slides[i]?.notes);
            if (notesChanged) {
                slides = next;
                byHash = new Map(next.map(s => [s.hash, s]));
                toAll(deckMessage());
            }
            if (changed) {
                state.index = followIndex(slides, next, state.index);
                slides = next;
                byHash = new Map(next.map(s => [s.hash, s]));
                // every change of the deck is a new state (a page holding the empty one before must take it); whether anyone has moved is `moved`
                state.version++;
                state.seq++;
                broadcastState();
                toAll(deckMessage());
            }
            console.log(`${changed ? '✓ drawn' : notesChanged ? '✓ notes changed' : '✓ unchanged'}: ${next.length} slides (${Date.now() - t0} ms)`);
            if (target)
                await publish(target, r.deck.title, next);
        }
        else {
            // the last good slides stay; the problems go to the presenter and to this terminal, never to a viewer (ADR 0056 D5)
            for (const e of errors)
                console.error(e.startsWith('✗') ? e : `✗ ${e}`);
            console.error(slides.length ? '  (the slides drawn before are still shown)' : '  (nothing to show until this is fixed)');
        }
        // a warning is said once, not again at every save
        for (const w of warnings)
            if (!problems.warnings.includes(w))
                console.error(`⚠ ${w}`);
        problems = { errors, warnings };
        toPresenters({ type: 'problems', ...problems });
    }
    catch (e) {
        console.error(`✗ drawing failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    finally {
        drawing = false;
        if (again) {
            again = false;
            void redraw();
        }
    }
}
// --- publishing to the presenter's own Worker (ADR 0056 D12) -----------------------------------------------------------------
let limits = null, published = '';
async function publish(t, title, list) {
    // what is sent: the slides' contents and what is said about them; the same again is not sent
    const digest = createHash('sha256').update(JSON.stringify([title, list.map(x => [x.hash, x.title, x.text, x.notes])])).digest('hex');
    if (digest === published)
        return;
    try {
        limits ??= await workerLimits(t);
        const over = overLimits(list, limits);
        if (over.length) {
            for (const o of over)
                console.error(`✗ ${o}`);
            console.error('  (not sent: the Worker keeps the slides it had)');
            return;
        }
        const { record } = await ensurePresentation(t);
        const version = await pushSlides(t, record, title, list);
        published = digest;
        console.log(`✓ published to ${t.origin} (version ${version})`);
    }
    catch (e) {
        if (e instanceof PublishError) {
            console.error(`✗ ${e.message}`);
            limits = null;
        }
        else
            throw e;
    }
}
// --- the presenter ----------------------------------------------------------------------------------------------------------
// kept per deck file (mode 0600, outside the deck's folder, which is often a git repository), so the presenter's page is still the
// presenter's after the server is started again, and can put back the slide it was on (ADR 0056 D6, D9)
function presenterToken() {
    const dir = path.join(process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config'), 'svg-diagram', 'serve');
    const file = path.join(dir, `${createHash('sha256').update(deckFile).digest('hex').slice(0, 32)}.json`);
    try {
        const t = JSON.parse(fs.readFileSync(file, 'utf8')).token;
        if (typeof t === 'string' && /^[A-Za-z0-9_-]{22,}$/.test(t))
            return t;
    }
    catch { /* none yet */ }
    const t = randomBytes(16).toString('base64url');
    try {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        fs.writeFileSync(file, JSON.stringify({ deck: deckFile, token: t }) + '\n', { mode: 0o600 });
    }
    catch { /* not kept: a new one at the next start */ }
    return t;
}
const token = target ? '' : presenterToken();
let port = firstPort;
const cookieName = () => `sd-presenter-${port}`;
/** The presenter's recent gos (a POST has no connection to count them on: the presenter's cookie is one, so they are counted together). */
const presenterGos = [], presenterPointers = [];
const isPresenter = (req) => { const v = cookieValue(req.headers.cookie, cookieName()); return v !== undefined && sameSecret(v, token); };
// --- addresses --------------------------------------------------------------------------------------------------------------
const lanAddresses = () => Object.values(os.networkInterfaces()).flat().filter((a) => !!a && !a.internal && a.family === 'IPv4').map(a => a.address);
const listensEverywhere = host === '0.0.0.0' || host === '::';
const names = [...LOOPBACK, ...(listensEverywhere ? lanAddresses() : [host]), ...all('--allow-host')];
let hosts = allowedHosts(names, port);
/** Where another device opens the viewer's page; null while only this machine can reach the server. */
function viewerUrl() {
    if (LOOPBACK.has(host))
        return null;
    const addr = listensEverywhere ? lanAddresses()[0] : host;
    return addr ? `http://${addr.includes(':') ? `[${addr}]` : addr}:${port}/` : null;
}
// --- HTTP -------------------------------------------------------------------------------------------------------------------
function send(res, status, headers, body) {
    res.writeHead(status, headers).end(body);
}
const notFound = (res) => send(res, 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }, 'not found');
const forbidden = (res, why) => send(res, 403, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }, why);
function pageConfig(role) {
    const url = viewerUrl();
    return role === 'viewer' ? { role, transport: 'sse', events: '/api/events', print: '/print' } : {
        role, transport: 'sse', events: '/api/events', go: '/api/go', print: '/print', notes: '/api/notes', claim: '/claim', viewerPath: '/', sseLimit: true,
        viewerUrl: url, qrSvg: url ? qrSvg(url, { moduleSize: 4 }) : null,
        qrNote: url ? '' : 'LAN の端末に見せるには --host 0.0.0.0 で起動してください',
    };
}
function readBody(req, limit = 4096) {
    return new Promise(resolve => {
        let body = '', over = false;
        req.on('data', (c) => { body += c; if (body.length > limit) {
            over = true;
            req.destroy();
        } });
        req.on('end', () => resolve(over ? null : body));
        req.on('error', () => resolve(null));
    });
}
const server = http.createServer(async (req, res) => {
    if (!hostOk(req.headers.host, hosts))
        return forbidden(res, 'this server answers only to its own addresses (use --allow-host NAME for another name)');
    const url = new URL(req.url ?? '/', 'http://x'), p = url.pathname, h = { host: req.headers.host, origin: req.headers.origin, secFetchSite: req.headers['sec-fetch-site'] };
    const title = deck?.title || slides[0]?.title || path.basename(deckFile, '.json');
    if (req.method === 'POST') {
        if (!postOk(h))
            return forbidden(res, 'not from this server\'s pages');
        if (p === '/claim') {
            const body = await readBody(req);
            let given = '';
            try {
                given = String(JSON.parse(body ?? '').token ?? '');
            }
            catch { /* answered below */ }
            if (!sameSecret(given, token))
                return forbidden(res, 'not the presenter\'s token');
            return send(res, 204, { 'set-cookie': `${cookieName()}=${token}; HttpOnly; SameSite=Strict; Path=/`, 'cache-control': 'no-store' }, '');
        }
        if (p === '/api/go') {
            if (!isPresenter(req))
                return forbidden(res, 'only the presenter moves the slides');
            const m = parsePresenter(await readBody(req, 200));
            if (!m)
                return send(res, 400, { 'content-type': 'text/plain' }, 'a message is {"type":"go","delta":±n}, {"type":"go","index":n}, {"type":"link","on":bool} or {"type":"pointer",…}');
            if (m.type === 'pointer' || m.type === 'zoom') {
                if (!allowGo(presenterPointers, Date.now(), POINTER_PER_SECOND))
                    return send(res, 429, { 'cache-control': 'no-store' }, '');
                toAll(m);
                return send(res, 204, { 'cache-control': 'no-store' }, '');
            }
            if (!allowGo(presenterGos, Date.now()))
                return send(res, 429, { 'cache-control': 'no-store' }, '');
            if (m.type === 'link') {
                if (linked !== m.on) {
                    linked = m.on;
                    state.seq++;
                    broadcastState();
                }
                return send(res, 204, { 'cache-control': 'no-store' }, '');
            }
            const next = applyGo(state, m, slides.length);
            if (next) {
                Object.assign(state, next);
                moved = true;
                broadcastState();
            }
            return send(res, 204, { 'cache-control': 'no-store' }, '');
        }
        return notFound(res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD')
        return send(res, 405, { allow: 'GET, HEAD, POST' }, '');
    if (p === '/')
        return send(res, 200, PAGE_HEADERS, viewerPage(title, pageConfig('viewer')));
    if (p === '/presenter')
        return send(res, 200, PAGE_HEADERS, presenterPage(title, pageConfig('presenter')));
    if (p === ASSET_JS)
        return send(res, 200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' }, PRESENT_JS);
    if (p === ASSET_CSS)
        return send(res, 200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' }, PRESENT_CSS);
    const svg = /^\/s\/([0-9a-f]{64})\.svg$/.exec(p);
    if (svg) {
        // only the slides of the current deck: a slide taken out or rewritten is gone (ADR 0056 D6)
        const s = byHash.get(svg[1]);
        return s ? send(res, 200, SVG_HEADERS, s.svg) : notFound(res);
    }
    if (p === '/api/events') {
        if (!streamOk(h))
            return forbidden(res, 'not from this server\'s pages');
        const c = { res, presenter: isPresenter(req) };
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
        res.write('retry: 3600000\n\n'); // the page reconnects by itself, with its own back-off
        clients.add(c);
        sendTo(c, { type: 'hello', role: c.presenter ? 'presenter' : 'viewer' });
        sendTo(c, stateMessage());
        sendTo(c, deckMessage());
        if (c.presenter)
            sendTo(c, { type: 'problems', ...problems });
        toPresenters(countMessage());
        const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
        req.on('close', () => { clearInterval(ping); clients.delete(c); toPresenters(countMessage()); });
        return;
    }
    // every slide is the viewers' too (ADR 0062): the print page is open to them
    if (p === '/print')
        return send(res, 200, PAGE_HEADERS, printPage(title, slides.map(s => ({ url: slideUrl(s), text: s.text }))));
    // the presenter's own: the notes, the .pptx
    if (p === '/api/notes' || p === '/deck.pptx') {
        if (!isPresenter(req))
            return forbidden(res, 'only the presenter: open the presenter\'s URL first');
        if (p === '/api/notes')
            return send(res, 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' }, JSON.stringify({ version: state.version, notes: slides.map(s => s.notes) }));
        const out = path.join(os.tmpdir(), `svg-diagram-serve-${process.pid}-${randomBytes(6).toString('hex')}.pptx`);
        const bin = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? './pptx-deck-diagram.ts' : './pptx-deck-diagram.js', import.meta.url));
        // the file name may be Japanese: an HTTP header holds only Latin-1, so the name goes as filename* (RFC 6266) beside an ASCII one
        const name = `${path.basename(deckFile, '.json')}.pptx`;
        const disposition = `attachment; filename="deck.pptx"; filename*=UTF-8''${encodeURIComponent(name)}`;
        execFile(process.execPath, [bin, deckFile, '--out', out], (err, _o, stderr) => {
            try {
                if (err)
                    return send(res, 500, { 'content-type': 'text/plain; charset=utf-8' }, stderr || err.message);
                const data = fs.readFileSync(out);
                send(res, 200, { 'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'content-disposition': disposition, 'cache-control': 'no-store' }, data);
            }
            catch (e) {
                if (!res.headersSent)
                    send(res, 500, { 'content-type': 'text/plain; charset=utf-8' }, e instanceof Error ? e.message : String(e));
                else
                    res.destroy();
            }
            finally {
                fs.rmSync(out, { force: true });
            }
        });
        return;
    }
    return notFound(res);
});
function listen() {
    return new Promise((resolve, reject) => {
        const onError = (e) => {
            server.off('listening', onListening);
            if (e.code === 'EADDRINUSE' && port < firstPort + 20 && portText === undefined) {
                port++;
                listen().then(resolve, reject);
            }
            else
                reject(e);
        };
        const onListening = () => { server.off('error', onError); resolve(); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
    });
}
const printQr = (url) => {
    // qrTerminal draws the light modules as blocks: white blocks on black whatever the terminal's own colours, so a phone reads it
    console.log(qrTerminal(url).split('\n').map(l => l ? `\x1b[97;40m${l}\x1b[0m` : l).join('\n'));
};
if (target) {
    // --publish: no server here; the slides go to the Worker at every save, and the Worker's URLs are the ones to share
    try {
        limits = await workerLimits(target);
    }
    catch (e) {
        console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
    }
    await redraw();
    const record = readRecord(target);
    if (!record) {
        console.error('✗ nothing is published yet: fix the problems above and save again');
    }
    else {
        const vu = viewerUrlOf(record);
        console.log(`\nviewers:    ${vu}`);
        printQr(vu);
        const [tok] = record.presenterTokens;
        console.log(tok ? `presenter:  ${presenterUrlOf(record, tok)}   (keep this one to yourself)` : 'presenter:  (no token: --publish --new-presenter-token makes one, or sign in at ' + new URL(`/p/${record.id}/login`, record.origin).href + ')');
    }
    console.log('watching for changes; each save is published (Ctrl+C to stop)');
    process.on('SIGINT', () => process.exit(0));
}
else {
    await redraw();
    try {
        await listen();
    }
    catch (e) {
        console.error(`✗ cannot listen on ${host}:${port}: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
    }
    hosts = allowedHosts(names, port);
    const shown = LOOPBACK.has(host) || listensEverywhere ? 'localhost' : host.includes(':') ? `[${host}]` : host;
    const presenterUrl = `http://${shown}:${port}/presenter#token=${token}`;
    const vu = viewerUrl();
    console.log(`\nslides:     http://${shown}:${port}/`);
    console.log(`presenter:  ${presenterUrl}   (keep this one to yourself)`);
    if (vu) {
        console.log(`viewers:    ${vu}`);
        printQr(vu);
        console.log('⚠ on a LAN the pages travel unencrypted: someone on the same network can read the presenter\'s cookie. In a venue\'s Wi-Fi, prefer --publish.');
    }
    else
        console.log('            (other devices cannot reach this server: start it with --host 0.0.0.0 to show the slides on the LAN)');
    console.log('watching for changes (Ctrl+C to stop)');
    if (args.includes('--open')) {
        const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
        spawn(opener, [presenterUrl], { stdio: 'ignore', detached: true }).on('error', () => { }).unref();
    }
    process.on('SIGINT', () => { for (const c of clients)
        c.res.end(); server.close(); process.exit(0); });
}
