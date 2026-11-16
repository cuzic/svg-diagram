// A browser without playwright: Chromium driven over the DevTools protocol on a pipe, just far enough for what svg-diagram asks of a page
// (measure text, draw an SVG as an <img>, the checks of `lint --engine browser`). For a machine that has a Chromium and Node but no npm packages
// — ChatGPT's Code Interpreter, where Python's playwright has downloaded one. The shape is the part of Playwright's API the code uses
// (newPage / setContent / evaluate / goto / locator().count() / close), so lib/browser.ts hands it out in place of Playwright's Browser.
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import {Socket} from 'node:net';
import path from 'node:path';

const exists = (p: string) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

/** Revision number of a Playwright cache directory name (`chromium-1228` → 1228), so the newest download is tried first. */
const revisionOf = (name: string) => Number(/-(\d+)$/.exec(name)?.[1] ?? 0);

/** Every Chromium that Python's (or Node's) playwright has downloaded under `root`, newest first; the full browser before the headless shell. */
function playwrightDownloads(root: string): string[] {
  let names: string[];
  try { names = fs.readdirSync(root); } catch { return []; }
  const find = (prefix: string, bins: string[]) => names.filter(n => n.startsWith(prefix + '-')).sort((a, b) => revisionOf(b) - revisionOf(a))
    .flatMap(n => fs.readdirSync(path.join(root, n), {withFileTypes: true}).filter(d => d.isDirectory() && /^chrome-/.test(d.name)).flatMap(d => bins.map(b => path.join(root, n, d.name, b))));
  return [...find('chromium', ['chrome', 'Chromium.app/Contents/MacOS/Chromium', 'chrome.exe']), ...find('chromium_headless_shell', ['headless_shell', 'chrome-headless-shell.exe'])].filter(exists);
}

/**
 * The Chromium to drive, or null: SVG_DIAGRAM_CHROMIUM (or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) if set, else one that playwright downloaded
 * (PLAYWRIGHT_BROWSERS_PATH, ~/.cache/ms-playwright, and the places a container puts it), else a chromium / chrome on the PATH.
 */
export function findChromium(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const v of [env['SVG_DIAGRAM_CHROMIUM'], env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']]) if (v) return v;
  const roots = [env['PLAYWRIGHT_BROWSERS_PATH'], path.join(os.homedir(), '.cache', 'ms-playwright'), path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'), '/ms-playwright', '/opt/ms-playwright', '/root/.cache/ms-playwright']
    .filter((r): r is string => !!r && r !== '0');
  for (const r of roots) { const hit = playwrightDownloads(r)[0]; if (hit) return hit; }
  const names = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome'];
  const dirs = (env['PATH'] ?? '').split(path.delimiter).filter(Boolean);
  for (const n of names) for (const d of dirs) { const p = path.join(d, n); if (exists(p)) return p; }
  return null;
}

type Json = Record<string, unknown>;

class Connection {
  private id = 0;
  private pending = new Map<number, {resolve: (v: Json) => void; reject: (e: Error) => void}>();
  private buffer = '';
  private out: NodeJS.WritableStream;
  constructor(child: ChildProcess, out: NodeJS.WritableStream, input: NodeJS.ReadableStream) {
    this.out = out;
    input.setEncoding('utf8');
    input.on('data', (chunk: string) => {
      this.buffer += chunk;
      for (let nul = this.buffer.indexOf('\0'); nul !== -1; nul = this.buffer.indexOf('\0')) {
        const msg = JSON.parse(this.buffer.slice(0, nul)) as {id?: number; result?: Json; error?: {message: string}};
        this.buffer = this.buffer.slice(nul + 1);
        const p = msg.id === undefined ? undefined : this.pending.get(msg.id);
        if (!p || msg.id === undefined) continue;
        this.pending.delete(msg.id);
        this.idle();
        if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result ?? {});
      }
    });
    child.on('exit', () => { for (const p of this.pending.values()) p.reject(new Error('the browser exited')); this.pending.clear(); });
    this.sockets = [child.stdio[2], child.stdio[3], child.stdio[4]].filter((x): x is Socket => x instanceof Socket);
  }
  // Like a Playwright browser, an open one does not keep the process alive; but a request that is waiting for its answer does.
  private sockets: Socket[];
  settle() { this.idle(); }
  private idle() { if (this.pending.size === 0) for (const s of this.sockets) s.unref(); }
  send(method: string, params: Json = {}, sessionId?: string): Promise<Json> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      if (this.pending.size === 0) for (const s of this.sockets) s.ref();
      this.pending.set(id, {resolve, reject});
      this.out.write(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}) + '\0');
    });
  }
}

const describe = (d: {text?: string; exception?: {description?: string; value?: unknown}}) => d.exception?.description ?? String(d.exception?.value ?? d.text ?? 'evaluation failed');

export class CdpPage {
  private conn: Connection;
  private targetId: string;
  private sessionId: string;
  constructor(conn: Connection, targetId: string, sessionId: string) { this.conn = conn; this.targetId = targetId; this.sessionId = sessionId; }
  private call(method: string, params: Json = {}) { return this.conn.send(method, params, this.sessionId); }

  /** Run `fn(arg)` in the page and return its (JSON) result, waiting for a promise it returns — as Playwright's page.evaluate does. */
  async evaluate<R, A = undefined>(fn: string | ((arg: A) => R | Promise<R>), arg?: A): Promise<R> {
    const expression = typeof fn === 'string' ? fn : `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`;
    const r = await this.call('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}) as {result: {value?: R}; exceptionDetails?: Parameters<typeof describe>[0]};
    if (r.exceptionDetails) throw new Error(describe(r.exceptionDetails));
    return r.result.value as R;
  }

  /** Replace the document with `html` and wait until it has loaded. */
  async setContent(html: string, _opts?: {waitUntil?: string}): Promise<void> {
    await this.evaluate(async (h: string) => {
      document.open(); document.write(h); document.close();
      while (document.readyState !== 'complete') await new Promise(r => setTimeout(r, 5));
    }, html);
  }

  async goto(url: string): Promise<void> {
    const r = await this.call('Page.navigate', {url}) as {errorText?: string};
    if (r.errorText) throw new Error(`${url}: ${r.errorText}`);
    while (await this.evaluate<string>('document.readyState') !== 'complete') await new Promise(res => setTimeout(res, 50));
  }

  waitForTimeout(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

  async waitForSelector(selector: string, opts: {timeout?: number} = {}): Promise<void> {
    const until = Date.now() + (opts.timeout ?? 30000);
    while (!(await this.locator(selector).count())) {
      if (Date.now() > until) throw new Error(`waiting for selector ${selector}: timeout`);
      await new Promise(r => setTimeout(r, 100));
    }
  }

  locator(selector: string): {count(): Promise<number>} {
    return {count: () => this.evaluate((s: string) => document.querySelectorAll(s).length, selector)};
  }

  async close(): Promise<void> { await this.conn.send('Target.closeTarget', {targetId: this.targetId}).catch(() => {}); }
}

export class CdpBrowser {
  private child: ChildProcess;
  private conn: Connection;
  private profile: string;
  constructor(child: ChildProcess, conn: Connection, profile: string) { this.child = child; this.conn = conn; this.profile = profile; }

  async newPage(opts: {viewport?: {width: number; height: number}} = {}): Promise<CdpPage> {
    const {targetId} = await this.conn.send('Target.createTarget', {url: 'about:blank'}) as {targetId: string};
    const {sessionId} = await this.conn.send('Target.attachToTarget', {targetId, flatten: true}) as {sessionId: string};
    const {width, height} = opts.viewport ?? {width: 1280, height: 720}; // Playwright's default viewport
    await this.conn.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
    return new CdpPage(this.conn, targetId, sessionId);
  }

  async close(): Promise<void> {
    const gone = new Promise<void>(r => this.child.once('exit', () => r()));
    await this.conn.send('Browser.close').catch(() => {});
    const timer = setTimeout(() => this.child.kill('SIGKILL'), 3000);
    await gone;
    clearTimeout(timer);
    fs.rmSync(this.profile, {recursive: true, force: true});
  }
}

export interface CdpLaunch {executablePath?: string; args?: string[]}

export async function launchCdp(options: CdpLaunch = {}): Promise<CdpBrowser> {
  const exe = options.executablePath ?? findChromium();
  if (!exe) throw new Error('no Chromium was found (looked for SVG_DIAGRAM_CHROMIUM, the playwright download in ~/.cache/ms-playwright, and chromium / google-chrome on the PATH)');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-diagram-chromium-'));
  const args = ['--headless', '--remote-debugging-pipe', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-extensions', '--hide-scrollbars', '--mute-audio', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), ...(options.args ?? []), 'about:blank'];
  const child = spawn(exe, [...new Set(args)], {stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe']});
  let stderr = '';
  child.stderr?.on('data', d => { stderr = (stderr + String(d)).slice(-2000); });
  const failed = new Promise<never>((_, reject) => {
    child.once('error', e => reject(new Error(`could not start ${exe}: ${e.message}`)));
    child.once('exit', code => reject(new Error(`${exe} exited at start (${code})${stderr ? `:\n${stderr.trim()}` : ''}`)));
  });
  failed.catch(() => {}); // (an exit after a successful start is not an error here)
  const conn = new Connection(child, child.stdio[3] as NodeJS.WritableStream, child.stdio[4] as NodeJS.ReadableStream);
  const browser = new CdpBrowser(child, conn, profile);
  try { await Promise.race([conn.send('Browser.getVersion'), failed]); }
  catch (e) { child.kill('SIGKILL'); fs.rmSync(profile, {recursive: true, force: true}); throw e; }
  child.unref();
  conn.settle();
  return browser;
}

/** Whether `exe` starts at all (a missing shared library shows here), for a clear message before the first page. */
export function chromiumRuns(exe: string): boolean { return spawnSync(exe, ['--version'], {timeout: 10000}).status === 0; }
