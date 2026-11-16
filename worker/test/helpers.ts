// Running the Worker for the tests as it runs for real: `wrangler dev` (workerd) on this machine, with Google and Cloudflare Access replaced
// by small fakes on 127.0.0.1 (ADR 0056 D17). Nothing here reaches Cloudflare or Google.
import {spawn, type ChildProcess} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const WORKER = path.resolve(import.meta.dirname, '..');
export const PUBLISH_TOKEN = 'p'.repeat(40), SESSION_SECRET = 's'.repeat(40);

export const freePort = (): Promise<number> => new Promise(resolve => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); });
});

export interface Running {origin: string; stop(): Promise<void>; log(): string}
/** `wrangler dev` with these vars, on a free port, its storage in `persist` (kept across starts when given the same folder). */
export async function startWorker(vars: Record<string, string>, persist = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-worker-'))): Promise<Running> {
  const port = await freePort();
  const args = ['dev', '-c', 'wrangler.test.jsonc', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', persist, '--show-interactive-dev-session=false',
    ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])];
  const child: ChildProcess = spawn(path.join(WORKER, 'node_modules/.bin/wrangler'), args, {cwd: WORKER, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1'}, detached: true});
  let log = '';
  child.stdout?.on('data', (b: Buffer) => { log += b; });
  child.stderr?.on('data', (b: Buffer) => { log += b; });
  const origin = `http://localhost:${port}`;
  for (let i = 0; ; i++) {
    if (i > 240) { process.kill(-(child.pid ?? 0)); throw new Error(`wrangler dev did not start:\n${log}`); }
    try { await fetch(`${origin}/api/version`); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  return {
    origin, log: () => log,
    stop: () => new Promise<void>(resolve => { child.once('exit', () => resolve()); try { process.kill(-(child.pid ?? 0), 'SIGTERM'); } catch { resolve(); } }),
  };
}

const b64u = (b: Buffer | string): string => Buffer.from(b).toString('base64url');

/** A fake Google: /authorize answers at once with a code; /token checks PKCE and returns an id_token with the claims `claims` holds now. */
export async function fakeGoogle(): Promise<{url: string; claims: Record<string, unknown>; close(): void}> {
  const claims: Record<string, unknown> = {email: 'alice@example.com', email_verified: true, hd: 'example.com'};
  const codes = new Map<string, {nonce: string; challenge: string; client: string}>();
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    if (u.pathname === '/authorize') {
      const code = crypto.randomUUID();
      codes.set(code, {nonce: u.searchParams.get('nonce') ?? '', challenge: u.searchParams.get('code_challenge') ?? '', client: u.searchParams.get('client_id') ?? ''});
      res.writeHead(302, {location: `${u.searchParams.get('redirect_uri')}?code=${code}&state=${u.searchParams.get('state')}`}).end();
      return;
    }
    if (u.pathname === '/token') {
      let body = '';
      for await (const c of req) body += c;
      const f = new URLSearchParams(body), c = codes.get(f.get('code') ?? '');
      codes.delete(f.get('code') ?? '');
      if (!c || b64u(crypto.createHash('sha256').update(f.get('code_verifier') ?? '').digest()) !== c.challenge) { res.writeHead(400).end('{"error":"invalid_grant"}'); return; }
      const p = {iss: 'https://accounts.google.com', aud: c.client, sub: '1', nonce: c.nonce, exp: Math.floor(Date.now() / 1000) + 300, ...claims};
      res.writeHead(200, {'content-type': 'application/json'}).end(JSON.stringify({id_token: `${b64u('{"alg":"RS256"}')}.${b64u(JSON.stringify(p))}.x`}));
      return;
    }
    res.writeHead(404).end();
  });
  const port = await freePort();
  await new Promise<void>(r => server.listen(port, '127.0.0.1', r));
  return {url: `http://127.0.0.1:${port}`, claims, close: () => server.close()};
}

/** A fake Access team: its keys at /cdn-cgi/access/certs, and JWTs signed (or broken) the ways the tests ask for. */
export async function fakeAccess(aud: string): Promise<{url: string; iss: string; jwt(kind?: string, email?: string): string; close(): void}> {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
  const other = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
  const jwk = {...publicKey.export({format: 'jwk'}), kid: 'k1', alg: 'RS256', use: 'sig'};
  const server = http.createServer((req, res) => {
    if (req.url === '/cdn-cgi/access/certs') res.writeHead(200, {'content-type': 'application/json'}).end(JSON.stringify({keys: [jwk], public_certs: []}));
    else res.writeHead(404).end();
  });
  const port = await freePort();
  await new Promise<void>(r => server.listen(port, '127.0.0.1', r));
  const iss = `http://127.0.0.1:${port}`;
  return {
    url: iss, iss, close: () => server.close(),
    jwt(kind = 'ok', email = 'bob@example.com') {
      const now = Math.floor(Date.now() / 1000);
      const p = {aud: [kind === 'aud' ? 'another' : aud], iss: kind === 'iss' ? 'https://evil.cloudflareaccess.com' : iss, exp: kind === 'expired' ? now - 10 : now + 300, iat: now, ...(kind === 'noemail' ? {} : {email})};
      const data = `${b64u(JSON.stringify({alg: 'RS256', kid: kind === 'kid' ? 'k9' : 'k1'}))}.${b64u(JSON.stringify(p))}`;
      return `${data}.${b64u(crypto.sign('sha256', Buffer.from(data), kind === 'sig' ? other.privateKey : privateKey))}`;
    },
  };
}

/** A small slide that passes the allowlist; `n` makes each one different. */
export const slideSvg = (n: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#ffffff"/><rect x="${n}" y="10" width="100" height="100" fill="#1f5fa8"/></svg>`;
export const sha256 = (s: string): string => crypto.createHash('sha256').update(s).digest('hex');

/** A WebSocket to the Worker with the headers a browser page would send, and its messages. */
export async function socket(origin: string, id: string, headers: Record<string, string> = {origin}) {
  const ws = new WebSocket(`${origin.replace(/^http/, 'ws')}/p/${id}/ws`, {headers} as unknown as string[]) as WebSocket & {
    onmessage: ((e: {data: unknown}) => void) | null; onclose: ((e: {code: number}) => void) | null; onopen: (() => void) | null; onerror: (() => void) | null; readyState: number;
  };
  const got: Record<string, unknown>[] = [], waiters: {pred: (m: Record<string, unknown>) => boolean; resolve: (m: Record<string, unknown>) => void}[] = [];
  let closed: {code: number} | null = null;
  ws.onmessage = e => {
    const m = JSON.parse(String(e.data)) as Record<string, unknown>;
    const w = waiters.findIndex(x => x.pred(m));
    if (w >= 0) waiters.splice(w, 1)[0]?.resolve(m); else got.push(m);
  };
  ws.onclose = e => { closed = {code: e.code}; };
  await new Promise<void>((resolve, reject) => { ws.onopen = () => resolve(); ws.onerror = () => reject(new Error('the WebSocket was refused')); });
  return {
    ws, got, closed: () => closed,
    /** Closing or closed: the server's close frame has arrived (under wrangler dev the closing handshake ends only when the process stops). */
    ending: () => ws.readyState >= 2,
    next(pred: (m: Record<string, unknown>) => boolean, ms = 10_000): Promise<Record<string, unknown>> {
      const i = got.findIndex(pred);
      if (i >= 0) return Promise.resolve(got.splice(i, 1)[0] as Record<string, unknown>);
      return new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('no such message')), ms); waiters.push({pred, resolve: m => { clearTimeout(t); resolve(m); }}); });
    },
    send: (m: unknown) => ws.send(JSON.stringify(m)),
  };
}
