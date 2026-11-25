// `svg-diagram serve deck.json --publish [ORIGIN]` (ADR 0056 D12): the slides drawn here sent to the presenter's own Worker. What the Worker
// made (the presentation's id, the presenter's tokens) is kept per Worker and deck in ~/.config/svg-diagram/publish/ (mode 0600), never
// next to the deck (often a git repository), so publishing again replaces the same presentation and its URL and QR stay the same.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROTOCOL } from './sync.js';
const configDir = () => path.join(process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config'), 'svg-diagram', 'publish');
const recordFile = (t) => path.join(configDir(), `${createHash('sha256').update(`${t.origin}\n${t.deckFile}`).digest('hex').slice(0, 32)}.json`);
export function readRecord(t) {
    try {
        const r = JSON.parse(fs.readFileSync(recordFile(t), 'utf8'));
        return r.origin === t.origin && r.deck === t.deckFile && /^[0-9a-f]{64}$/.test(r.id) ? r : null;
    }
    catch {
        return null;
    }
}
function writeRecord(t, r) {
    fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 });
    const f = recordFile(t);
    fs.writeFileSync(f, JSON.stringify(r, null, 2) + '\n', { mode: 0o600 });
    fs.chmodSync(f, 0o600);
}
function dropRecord(t) { fs.rmSync(recordFile(t), { force: true }); }
export class PublishError extends Error {
}
async function call(t, method, p, body) {
    let r;
    try {
        r = await fetch(new URL(p, t.origin), { method, headers: { authorization: `Bearer ${t.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    }
    catch (e) {
        throw new PublishError(`cannot reach ${t.origin}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const text = await r.text();
    let json = null;
    try {
        json = JSON.parse(text);
    }
    catch { /* not JSON */ }
    return { status: r.status, json, text };
}
/** The Worker's limits, after checking it speaks the same protocol and takes this PUBLISH_TOKEN. */
export async function workerLimits(t) {
    const r = await call(t, 'GET', '/api/version');
    if (r.status === 503 && r.json?.['problems'])
        throw new PublishError(`the Worker is not configured:\n  ${r.json['problems'].join('\n  ')}`);
    if (r.status !== 200 || !r.json)
        throw new PublishError(`${t.origin} is not an svg-diagram Worker (GET /api/version: ${r.status})`);
    const protocol = Number(r.json['protocol']);
    if (protocol !== PROTOCOL)
        throw new PublishError(`the Worker speaks protocol ${protocol}, this svg-diagram ${PROTOCOL}: ${protocol < PROTOCOL ? 'deploy the Worker from this version of svg-diagram (worker/ of the same tag)' : 'update svg-diagram to the version the Worker was deployed from'}`);
    const limits = r.json['limits'];
    if (!limits)
        throw new PublishError('the Worker did not take SVG_DIAGRAM_PUBLISH_TOKEN (it must equal the Worker\'s secret PUBLISH_TOKEN)');
    return limits;
}
/** What breaks the Worker's limits, each with its slide: checked here, before anything is sent. */
export function overLimits(slides, limits) {
    const out = [];
    if (slides.length > limits.maxSlides)
        out.push(`${slides.length} slides: the Worker takes at most ${limits.maxSlides} (MAX_SLIDES)`);
    let total = 0;
    const seen = new Set();
    slides.forEach((s, i) => {
        const bytes = Buffer.byteLength(s.svg);
        if (bytes > limits.maxSlideBytes)
            out.push(`slides[${i}]: ${bytes} bytes, over the Worker's ${limits.maxSlideBytes} per slide (MAX_SLIDE_BYTES): make its pictures smaller`);
        if (!seen.has(s.hash)) {
            seen.add(s.hash);
            total += bytes;
        }
    });
    const mib = (n) => `${(n / 1048576).toFixed(1)} MiB`;
    if (total > limits.maxDeckBytes)
        out.push(`the slides' SVGs come to ${mib(total)} together, over the Worker's ${mib(limits.maxDeckBytes)} (MAX_DECK_BYTES)${slides.length <= limits.maxSlides ? ` — the number of slides (${slides.length}) is within MAX_SLIDES (${limits.maxSlides}); the size is what is over` : ''}: make the pictures smaller, split the deck, or raise MAX_DECK_BYTES on the Worker`);
    return out;
}
/** The presentation for this Worker and deck: the one made before, or a new one. */
export async function ensurePresentation(t) {
    const had = readRecord(t);
    if (had)
        return { record: had, created: false };
    const r = await call(t, 'POST', '/api/p');
    if (r.status !== 201 || typeof r.json?.['id'] !== 'string')
        throw new PublishError(`the Worker did not make a presentation (${r.status}: ${r.text.slice(0, 200)})`);
    const record = { origin: t.origin, deck: t.deckFile, id: r.json['id'], presenterTokens: [String(r.json['presenterToken'])] };
    writeRecord(t, record);
    return { record, created: true };
}
/** The slides sent: first without the SVGs, then with the ones the Worker does not hold. Returns the Worker's version of the deck. */
export async function pushSlides(t, record, title, slides) {
    const meta = slides.map(s => ({ hash: s.hash, title: s.title, text: s.text, notes: s.notes, bytes: Buffer.byteLength(s.svg) }));
    let r = await call(t, 'PUT', `/api/p/${record.id}`, { title, slides: meta, svgs: {} });
    if (r.status === 409) {
        const need = new Set(r.json?.['need'] ?? []);
        const svgs = Object.fromEntries(slides.filter(s => need.has(s.hash)).map(s => [s.hash, s.svg]));
        r = await call(t, 'PUT', `/api/p/${record.id}`, { title, slides: meta, svgs });
    }
    if (r.status === 404) {
        dropRecord(t);
        throw new PublishError('the Worker no longer has this presentation (deleted, or past RETENTION_DAYS): publish again to make a new one');
    }
    if (r.status !== 200) {
        const problems = r.json?.['problems'] ?? [r.text.slice(0, 300)];
        throw new PublishError(`the Worker refused the slides (${r.status}):\n  ${problems.join('\n  ')}`);
    }
    return Number(r.json?.['version'] ?? 0);
}
export async function deletePresentation(t) {
    const record = readRecord(t);
    if (!record)
        return false;
    const r = await call(t, 'DELETE', `/api/p/${record.id}`);
    if (r.status !== 204 && r.status !== 404)
        throw new PublishError(`the Worker did not delete it (${r.status})`);
    dropRecord(t);
    return true;
}
export async function newPresenterToken(t) {
    const record = readRecord(t);
    if (!record)
        throw new PublishError('nothing published to this Worker from this deck yet');
    const r = await call(t, 'POST', `/api/p/${record.id}/tokens`);
    if (r.status !== 201)
        throw new PublishError(`no new token (${r.status}: ${r.text.slice(0, 200)})`);
    const token = String(r.json?.['presenterToken']);
    writeRecord(t, { ...record, presenterTokens: [...record.presenterTokens, token] });
    return token;
}
export async function revokePresenterTokens(t) {
    const record = readRecord(t);
    if (!record)
        throw new PublishError('nothing published to this Worker from this deck yet');
    const r = await call(t, 'DELETE', `/api/p/${record.id}/tokens`);
    if (r.status !== 204)
        throw new PublishError(`the tokens were not revoked (${r.status})`);
    writeRecord(t, { ...record, presenterTokens: [] });
}
export const viewerUrlOf = (r) => new URL(`/p/${r.id}`, r.origin).href;
export const presenterUrlOf = (r, token) => `${new URL(`/p/${r.id}/t`, r.origin).href}#token=${token}`;
