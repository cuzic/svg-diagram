// The Worker of `svg-diagram serve --publish` (ADR 0056 D11-D16), deployed by each presenter on their own Cloudflare account. It draws
// nothing: it keeps the outlined slide SVGs `--publish` sends, serves the viewer's and presenter's pages (core's lib/present/ui.ts), and
// moves every device to the presenter's slide (one Durable Object per presentation). Every URL it answers is below; anything else is 404.
import {ASSET_CSS, ASSET_JS, PAGE_CSP, PRESENT_CSS, PRESENT_JS, presenterPage, printPage, SVG_CSP, viewerPage} from '../../lib/present/ui.ts';
import {qrSvg} from '../../lib/present/qr.ts';
import {PROTOCOL} from '../../lib/present/sync.ts';
import {readSettings, type Env, type Settings} from './config.ts';
import {accessLogin, googleCallback, googleLogin, presenterCookie, sameSecret, seal, sessionOf, SESSION_SECONDS, setCookie, type Session} from './auth.ts';
import type {Presentation, PublishInput} from './presentation.ts';

export {Presentation} from './presentation.ts';

const PAGE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': PAGE_CSP,
  'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store',
};
const SVG_HEADERS = {
  'content-type': 'image/svg+xml; charset=utf-8',
  'content-security-policy': SVG_CSP,
  'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex', 'cache-control': 'public, max-age=31536000, immutable',
};
const text = (body: string, status: number, extra: Record<string, string> = {}): Response =>
  new Response(body, {status, headers: {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra}});
const json = (v: unknown, status = 200): Response => new Response(JSON.stringify(v), {status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});
const notFound = (): Response => text('not found', 404);

type Stub = DurableObjectStub<Presentation>;
function presentation(env: Env, s: Settings, id: string): Stub | null {
  let did: DurableObjectId;
  // an id this namespace did not make throws here, before any Durable Object is woken
  try { did = env.PRESENTATION.idFromString(id); } catch { return null; }
  return (env.PRESENTATION as DurableObjectNamespace<Presentation>).get(did, s.locationHint ? {locationHint: s.locationHint as DurableObjectLocationHint} : undefined);
}

const publisher = (req: Request, s: Settings): boolean => {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '');
  return !!m && sameSecret(m[1] ?? '', s.publishToken);
};
const sameOrigin = (req: Request): boolean => req.headers.get('origin') === new URL(req.url).origin;

/** The presenter, by the cookie alone (a revoked token's cookie is not the presenter's either). */
async function presenterOf(req: Request, s: Settings, id: string, stub: Stub): Promise<Session | null> {
  const session = await sessionOf(req, s, id);
  if (!session) return null;
  if (session.kind === 'token' && !await stub.tokenLive(session.tid)) return null;
  return session;
}

async function readJson<T>(req: Request, limit: number): Promise<T | null> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > limit) return null;
  const body = await req.text();
  if (body.length > limit) return null;
  try { return JSON.parse(body) as T; } catch { return null; }
}

async function api(req: Request, env: Env, s: Settings, path: string): Promise<Response> {
  if (path === '/api/version') return json({protocol: PROTOCOL, ...(publisher(req, s) ? {limits: {maxSlides: s.maxSlides, maxSlideBytes: s.maxSlideBytes, maxDeckBytes: s.maxDeckBytes}, login: s.login} : {})});
  if (!publisher(req, s)) return text('this needs the Worker\'s PUBLISH_TOKEN', 401, {'www-authenticate': 'Bearer'});
  if (path === '/api/p' && req.method === 'POST') {
    const id = env.PRESENTATION.newUniqueId().toString();
    const stub = presentation(env, s, id);
    if (!stub) return text('could not make a presentation', 500);
    const {token} = await stub.create();
    return json({id, presenterToken: token}, 201);
  }
  const m = /^\/api\/p\/([0-9a-f]{64})(\/tokens)?$/.exec(path);
  const stub = m && presentation(env, s, m[1] ?? '');
  if (!m || !stub) return notFound();
  if (m[2]) {
    if (!(await stub.info()).exists) return notFound();
    if (req.method === 'POST') { try { return json({presenterToken: await stub.addToken()}, 201); } catch (e) { return text(e instanceof Error ? e.message : String(e), 409); } }
    if (req.method === 'DELETE') { await stub.revokeTokens(); return new Response(null, {status: 204}); }
    return text('', 405);
  }
  if (req.method === 'DELETE') return await stub.remove() ? new Response(null, {status: 204}) : notFound();
  if (req.method === 'PUT') {
    const input = await readJson<PublishInput>(req, s.maxDeckBytes * 2 + 1_000_000);
    if (!input || typeof input !== 'object' || !Array.isArray(input.slides) || typeof input.svgs !== 'object' || input.svgs === null) return text('a deck is {title, slides: [{hash, title, text, notes, bytes}], svgs: {hash: svg}} within the size limit', 400);
    const r = await stub.publish(input);
    if (!r) return notFound();
    if (r.ok) return json(r);
    return json(r, r.status);
  }
  return text('', 405);
}

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url), path = url.pathname;
  if (path === ASSET_JS) return new Response(PRESENT_JS, {headers: {'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff'}});
  if (path === ASSET_CSS) return new Response(PRESENT_CSS, {headers: {'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff'}});
  const got = readSettings(env);
  if (!got.ok) {
    // what is wrong is for whoever deployed it: the log, and `--publish` (which holds PUBLISH_TOKEN); a viewer gets an empty 503
    console.error(`svg-diagram worker: not configured: ${got.problems.join('; ')}`);
    const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '');
    if (path.startsWith('/api/') && m && env.PUBLISH_TOKEN && sameSecret(m[1] ?? '', env.PUBLISH_TOKEN)) return json({error: 'not configured', problems: got.problems}, 503);
    return new Response(null, {status: 503, headers: {'cache-control': 'no-store'}});
  }
  const s = got.settings;
  if (path.startsWith('/api/')) return api(req, env, s, path);
  if (path === '/auth/google/callback' && req.method === 'GET') return googleCallback(req, s);

  const m = /^\/p\/([0-9a-f]{64})(\/presenter|\/t|\/login|\/print|\/ws|\/notes|\/s\/[0-9a-f]{64}\.svg)?$/.exec(path);
  if (!m) return notFound();
  const id = m[1] as string, rest = m[2] ?? '', stub = presentation(env, s, id);
  if (!stub) return notFound();
  const base = `/p/${id}`;

  if (rest.startsWith('/s/')) {
    const svg = await stub.svg(rest.slice(3, 67));
    return svg === null ? notFound() : new Response(svg, {headers: SVG_HEADERS});
  }
  if (rest === '/ws') {
    if (req.headers.get('upgrade') !== 'websocket') return text('a WebSocket', 426);
    // a browser always sends Origin on a WebSocket: none, or another site's, is not one of these pages (ADR 0056 D14)
    if (!sameOrigin(req)) return text('not from this Worker\'s pages', 403);
    const session = await presenterOf(req, s, id, stub);
    const h = new Headers(req.headers);
    for (const k of ['x-sd-role', 'x-sd-tid', 'x-sd-email']) h.delete(k); // only the Worker says who this is
    if (session) {
      h.set('x-sd-role', 'presenter');
      if (session.kind === 'token') h.set('x-sd-tid', session.tid); else h.set('x-sd-email', session.email);
    }
    return stub.fetch(new Request(req.url, {headers: h}));
  }
  if (rest === '/t' && req.method === 'POST') {
    if (!sameOrigin(req)) return text('not from this Worker\'s pages', 403);
    const body = await readJson<{token?: unknown}>(req, 1000);
    const tid = typeof body?.token === 'string' ? await stub.tokenId(body.token) : null;
    if (!tid) return text('not a presenter\'s token of this presentation', 403);
    const cookie = setCookie(presenterCookie(id), await seal(s.sessionSecret, presenterCookie(id), {id, kind: 'token', tid} satisfies Session, SESSION_SECONDS), SESSION_SECONDS);
    return new Response(null, {status: 204, headers: {'set-cookie': cookie, 'cache-control': 'no-store'}});
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return text('', 405);
  const info = await stub.info();
  if (!info.exists) return notFound();
  const title = info.title || info.first;
  const viewerUrl = `${url.origin}${base}`;
  const presenterConfig = {role: 'presenter' as const, transport: 'ws' as const, events: `${base}/ws`, notes: `${base}/notes`, print: `${base}/print`, viewerUrl, viewerPath: base, qrSvg: qrSvg(viewerUrl, {moduleSize: 4})};
  if (rest === '') return new Response(viewerPage(title, {role: 'viewer', transport: 'ws', events: `${base}/ws`, print: `${base}/print`}), {headers: PAGE_HEADERS});
  // every slide is the viewers' too (ADR 0062): the print page is open to them
  if (rest === '/print') { const p = await stub.printable(); return new Response(printPage(p.title || title, p.slides), {headers: PAGE_HEADERS}); }
  if (rest === '/presenter') return new Response(presenterPage(title, presenterConfig), {headers: PAGE_HEADERS});
  // the presenter's URL (`--publish` prints it with #token=…): the page trades the token for the cookie, then goes on to /presenter
  if (rest === '/t') return new Response(presenterPage(title, {...presenterConfig, claim: `${base}/t`, afterClaim: `${base}/presenter`}), {headers: PAGE_HEADERS});
  if (rest === '/login') {
    if (s.login === 'google') return googleLogin(req, s, id);
    if (s.login === 'access') return accessLogin(req, s, id);
    return text('this Worker signs presenters in by token only (PRESENTER_LOGIN is none)', 404);
  }
  const session = await presenterOf(req, s, id, stub);
  if (!session) return text('only the presenter: open the presenter\'s URL, or sign in at ' + base + '/login', 403);
  if (rest === '/notes') return new Response(JSON.stringify(await stub.notes()), {headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store'}});
  return notFound();
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try { return await handle(req, env); } catch (e) {
      console.error(`svg-diagram worker: ${e instanceof Error ? e.message : String(e)}`);
      return text('something went wrong', 500);
    }
  },
} satisfies ExportedHandler<Env>;
