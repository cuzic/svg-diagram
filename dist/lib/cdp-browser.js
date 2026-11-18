// A browser without playwright: Chromium driven over the DevTools protocol on a pipe, just far enough for what svg-diagram asks of a page
// (measure text, draw an SVG as an <img>, the checks of `lint --engine browser`). For a machine that has a Chromium and Node but no npm packages
// — ChatGPT's Code Interpreter, where Python's playwright has downloaded one. The shape is the part of Playwright's API the code uses
// (newPage / setContent / evaluate / goto / locator().count() / close), so lib/browser.ts hands it out in place of Playwright's Browser.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { Socket } from 'node:net';
import path from 'node:path';
const exists = (p) => { try {
    return fs.statSync(p).isFile();
}
catch {
    return false;
} };
/** Revision number of a Playwright cache directory name (`chromium-1228` → 1228), so the newest download is tried first. */
const revisionOf = (name) => Number(/-(\d+)$/.exec(name)?.[1] ?? 0);
/** Every Chromium that Python's (or Node's) playwright has downloaded under `root`, newest first; the full browser before the headless shell. */
function playwrightDownloads(root) {
    let names;
    try {
        names = fs.readdirSync(root);
    }
    catch {
        return [];
    }
    const find = (prefix, bins) => names.filter(n => n.startsWith(prefix + '-')).sort((a, b) => revisionOf(b) - revisionOf(a))
        .flatMap(n => fs.readdirSync(path.join(root, n), { withFileTypes: true }).filter(d => d.isDirectory() && /^chrome-/.test(d.name)).flatMap(d => bins.map(b => path.join(root, n, d.name, b))));
    return [...find('chromium', ['chrome', 'Chromium.app/Contents/MacOS/Chromium', 'chrome.exe']), ...find('chromium_headless_shell', ['headless_shell', 'chrome-headless-shell.exe'])].filter(exists);
}
/**
 * The Chromium to drive, or null: SVG_DIAGRAM_CHROMIUM (or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) if set, else one that playwright downloaded
 * (PLAYWRIGHT_BROWSERS_PATH, ~/.cache/ms-playwright, and the places a container puts it), else a chromium / chrome on the PATH.
 */
export function findChromium(env = process.env) {
    for (const v of [env['SVG_DIAGRAM_CHROMIUM'], env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']])
        if (v)
            return v;
    const roots = [env['PLAYWRIGHT_BROWSERS_PATH'], path.join(os.homedir(), '.cache', 'ms-playwright'), path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'), '/ms-playwright', '/opt/ms-playwright', '/root/.cache/ms-playwright']
        .filter((r) => !!r && r !== '0');
    for (const r of roots) {
        const hit = playwrightDownloads(r)[0];
        if (hit)
            return hit;
    }
    const names = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome'];
    const dirs = (env['PATH'] ?? '').split(path.delimiter).filter(Boolean);
    for (const n of names)
        for (const d of dirs) {
            const p = path.join(d, n);
            if (exists(p))
                return p;
        }
    return null;
}
class Connection {
    id = 0;
    pending = new Map();
    buffer = '';
    out;
    constructor(child, out, input) {
        this.out = out;
        input.setEncoding('utf8');
        input.on('data', (chunk) => {
            this.buffer += chunk;
            for (let nul = this.buffer.indexOf('\0'); nul !== -1; nul = this.buffer.indexOf('\0')) {
                const msg = JSON.parse(this.buffer.slice(0, nul));
                this.buffer = this.buffer.slice(nul + 1);
                const p = msg.id === undefined ? undefined : this.pending.get(msg.id);
                if (!p || msg.id === undefined)
                    continue;
                this.pending.delete(msg.id);
                this.idle();
                if (msg.error)
                    p.reject(new Error(msg.error.message));
                else
                    p.resolve(msg.result ?? {});
            }
        });
        child.on('exit', () => { for (const p of this.pending.values())
            p.reject(new Error('the browser exited')); this.pending.clear(); });
        this.sockets = [child.stdio[2], child.stdio[3], child.stdio[4]].filter((x) => x instanceof Socket);
    }
    // Like a Playwright browser, an open one does not keep the process alive; but a request that is waiting for its answer does.
    sockets;
    settle() { this.idle(); }
    idle() { if (this.pending.size === 0)
        for (const s of this.sockets)
            s.unref(); }
    send(method, params = {}, sessionId) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            if (this.pending.size === 0)
                for (const s of this.sockets)
                    s.ref();
            this.pending.set(id, { resolve, reject });
            this.out.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
        });
    }
}
const describe = (d) => d.exception?.description ?? String(d.exception?.value ?? d.text ?? 'evaluation failed');
export class CdpPage {
    conn;
    targetId;
    sessionId;
    constructor(conn, targetId, sessionId) { this.conn = conn; this.targetId = targetId; this.sessionId = sessionId; }
    call(method, params = {}) { return this.conn.send(method, params, this.sessionId); }
    /** Run `fn(arg)` in the page and return its (JSON) result, waiting for a promise it returns — as Playwright's page.evaluate does. */
    async evaluate(fn, arg) {
        const expression = typeof fn === 'string' ? fn : `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`;
        const r = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails)
            throw new Error(describe(r.exceptionDetails));
        return r.result.value;
    }
    /** Replace the document with `html` and wait until it has loaded. */
    async setContent(html, _opts) {
        await this.evaluate(async (h) => {
            document.open();
            document.write(h);
            document.close();
            while (document.readyState !== 'complete')
                await new Promise(r => setTimeout(r, 5));
        }, html);
    }
    async goto(url) {
        const r = await this.call('Page.navigate', { url });
        if (r.errorText)
            throw new Error(`${url}: ${r.errorText}`);
        while (await this.evaluate('document.readyState') !== 'complete')
            await new Promise(res => setTimeout(res, 50));
    }
    waitForTimeout(ms) { return new Promise(r => setTimeout(r, ms)); }
    async waitForSelector(selector, opts = {}) {
        const until = Date.now() + (opts.timeout ?? 30000);
        while (!(await this.locator(selector).count())) {
            if (Date.now() > until)
                throw new Error(`waiting for selector ${selector}: timeout`);
            await new Promise(r => setTimeout(r, 100));
        }
    }
    locator(selector) {
        return { count: () => this.evaluate((s) => document.querySelectorAll(s).length, selector) };
    }
    async close() { await this.conn.send('Target.closeTarget', { targetId: this.targetId }).catch(() => { }); }
}
export class CdpBrowser {
    child;
    conn;
    profile;
    constructor(child, conn, profile) { this.child = child; this.conn = conn; this.profile = profile; }
    async newPage(opts = {}) {
        const { targetId } = await this.conn.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await this.conn.send('Target.attachToTarget', { targetId, flatten: true });
        const { width, height } = opts.viewport ?? { width: 1280, height: 720 }; // Playwright's default viewport
        await this.conn.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
        return new CdpPage(this.conn, targetId, sessionId);
    }
    async close() {
        const gone = new Promise(r => this.child.once('exit', () => r()));
        await this.conn.send('Browser.close').catch(() => { });
        const timer = setTimeout(() => this.child.kill('SIGKILL'), 3000);
        await gone;
        clearTimeout(timer);
        fs.rmSync(this.profile, { recursive: true, force: true });
    }
}
export async function launchCdp(options = {}) {
    const exe = options.executablePath ?? findChromium();
    if (!exe)
        throw new Error('no Chromium was found (looked for SVG_DIAGRAM_CHROMIUM, the playwright download in ~/.cache/ms-playwright, and chromium / google-chrome on the PATH)');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-diagram-chromium-'));
    const args = ['--headless', '--remote-debugging-pipe', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
        '--disable-background-networking', '--disable-extensions', '--hide-scrollbars', '--mute-audio', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), ...(options.args ?? []), 'about:blank'];
    const child = spawn(exe, [...new Set(args)], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', d => { stderr = (stderr + String(d)).slice(-2000); });
    const failed = new Promise((_, reject) => {
        child.once('error', e => reject(new Error(`could not start ${exe}: ${e.message}`)));
        child.once('exit', code => reject(new Error(`${exe} exited at start (${code})${stderr ? `:\n${stderr.trim()}` : ''}`)));
    });
    failed.catch(() => { }); // (an exit after a successful start is not an error here)
    const conn = new Connection(child, child.stdio[3], child.stdio[4]);
    const browser = new CdpBrowser(child, conn, profile);
    try {
        await Promise.race([conn.send('Browser.getVersion'), failed]);
    }
    catch (e) {
        child.kill('SIGKILL');
        fs.rmSync(profile, { recursive: true, force: true });
        throw e;
    }
    child.unref();
    conn.settle();
    return browser;
}
/** Whether `exe` starts at all (a missing shared library shows here), for a clear message before the first page. */
export function chromiumRuns(exe) { return spawnSync(exe, ['--version'], { timeout: 10000 }).status === 0; }
