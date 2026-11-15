// Who is the presenter on the Worker (ADR 0056 D13). A presenter's token (POST /p/<id>/t) or a verified email address (Cloudflare Access's
// JWT, or Google's OpenID Connect) is traded for a cookie, `__Host-p-<id>`, sealed with SESSION_SECRET; the presenter's pages and the
// WebSocket go by that cookie alone, checked again on every request against the revoked tokens and the current PRESENTER_EMAILS.
import type {Settings} from './config.ts';

const enc = new TextEncoder(), dec = new TextDecoder();
export const b64u = (b: ArrayBuffer | Uint8Array): string => {
  let s = '';
  for (const c of new Uint8Array(b)) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
export const sha256Hex = async (s: string): Promise<string> => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
export const randomToken = (bytes = 16): string => b64u(crypto.getRandomValues(new Uint8Array(bytes)));

/** Whether two strings are equal, in a time that does not depend on where they differ. */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const keys = new Map<string, Promise<CryptoKey>>();
const keyOf = (secret: string): Promise<CryptoKey> => {
  let k = keys.get(secret);
  if (!k) {
    k = crypto.subtle.digest('SHA-256', enc.encode(`svg-diagram cookie\n${secret}`)).then(raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
    keys.set(secret, k);
  }
  return k;
};
/** `value` encrypted and authenticated (AES-GCM) for the cookie `name`: it cannot be read, changed, or moved to another cookie. */
export async function seal(secret: string, name: string, value: object, seconds: number): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = enc.encode(JSON.stringify({...value, exp: Math.floor(Date.now() / 1000) + seconds}));
  const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: enc.encode(name)}, await keyOf(secret), body);
  return `${b64u(iv)}.${b64u(ct)}`;
}
export async function unseal<T>(secret: string, name: string, sealed: string | undefined): Promise<T | null> {
  if (!sealed) return null;
  const [iv, ct] = sealed.split('.');
  if (!iv || !ct) return null;
  try {
    const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64u(iv), additionalData: enc.encode(name)}, await keyOf(secret), unb64u(ct));
    const v = JSON.parse(dec.decode(plain)) as {exp?: number};
    return typeof v.exp === 'number' && v.exp > Date.now() / 1000 ? v as T : null;
  } catch { return null; }
}

export const cookieOf = (req: Request, name: string): string | undefined => {
  for (const part of (req.headers.get('cookie') ?? '').split(/;\s*/)) if (part.startsWith(name + '=')) return part.slice(name.length + 1);
  return undefined;
};
export const setCookie = (name: string, value: string, seconds: number): string => `${name}=${value}; Max-Age=${seconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
export const presenterCookie = (id: string): string => `__Host-p-${id}`;
const OIDC = '__Host-oidc';
/** How long a presenter stays signed in. */
export const SESSION_SECONDS = 8 * 3600;

/** What the presenter's cookie says: by a token (its id) or by an email address. */
export type Session = {id: string; kind: 'token'; tid: string} | {id: string; kind: 'email'; email: string};

export async function sessionOf(req: Request, s: Settings, id: string): Promise<Session | null> {
  const v = await unseal<Session>(s.sessionSecret, presenterCookie(id), cookieOf(req, presenterCookie(id)));
  if (!v || v.id !== id) return null;
  // an address taken off the list stops being the presenter's at once (a token is checked against the revoked ones by the presentation)
  if (v.kind === 'email' && (s.login === 'none' || !s.presenterEmails.includes(v.email.toLowerCase()))) return null;
  return v;
}

export async function signedIn(s: Settings, id: string, session: Session, to: string): Promise<Response> {
  const h = new Headers({location: to, 'cache-control': 'no-store'});
  h.append('set-cookie', setCookie(presenterCookie(id), await seal(s.sessionSecret, presenterCookie(id), session, SESSION_SECONDS), SESSION_SECONDS));
  h.append('set-cookie', setCookie(OIDC, '', 0));
  return new Response(null, {status: 302, headers: h});
}

const deny = (why: string, status = 403): Response => new Response(why, {status, headers: {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'}});
const jwtParts = (t: string) => {
  const [h, p, sig] = t.split('.');
  if (!h || !p || sig === undefined) throw new Error('malformed');
  return {h: JSON.parse(dec.decode(unb64u(h))) as {alg?: string; kid?: string}, p: JSON.parse(dec.decode(unb64u(p))) as Record<string, unknown>, signed: `${h}.${p}`, sig};
};

// --- Google (OpenID Connect: code flow with PKCE, state and nonce) ------------------------------------------------------------
export async function googleLogin(req: Request, s: Settings, id: string): Promise<Response> {
  const g = s.google;
  if (!g) return deny('Google sign-in is not set up', 404);
  const state = randomToken(), nonce = randomToken(), verifier = randomToken(32);
  const challenge = b64u(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
  const origin = new URL(req.url).origin;
  const q = new URLSearchParams({client_id: g.clientId, redirect_uri: `${origin}/auth/google/callback`, response_type: 'code', scope: 'openid email', state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account', ...(g.hd ? {hd: g.hd} : {})});
  const h = new Headers({location: `${g.authUrl}?${q}`, 'cache-control': 'no-store'});
  // where the sign-in started and its secrets ride in a 10-minute sealed cookie: no store to keep them in
  h.append('set-cookie', setCookie(OIDC, await seal(s.sessionSecret, OIDC, {state, nonce, verifier, id}, 600), 600));
  return new Response(null, {status: 302, headers: h});
}

export async function googleCallback(req: Request, s: Settings): Promise<Response> {
  const g = s.google;
  if (!g) return deny('Google sign-in is not set up', 404);
  const u = new URL(req.url);
  const t = await unseal<{state: string; nonce: string; verifier: string; id: string}>(s.sessionSecret, OIDC, cookieOf(req, OIDC));
  if (!t) return deny('no sign-in in progress (start again from the presenter\'s sign-in)', 400);
  if (!sameSecret(u.searchParams.get('state') ?? '', t.state)) return deny('the sign-in does not match (state)', 400);
  const r = await fetch(g.tokenUrl, {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({code: u.searchParams.get('code') ?? '', client_id: g.clientId, client_secret: g.clientSecret, redirect_uri: `${u.origin}/auth/google/callback`, grant_type: 'authorization_code', code_verifier: t.verifier})});
  if (!r.ok) return deny('Google did not accept the sign-in', 400);
  let p: Record<string, unknown>;
  // straight from Google's token endpoint over TLS: OpenID Connect Core 3.1.3.7 lets the signature check go; the claims are checked
  try { p = jwtParts(((await r.json()) as {id_token?: string}).id_token ?? '').p; } catch { return deny('Google sent no id_token', 400); }
  if (p['iss'] !== g.iss || p['aud'] !== g.clientId || p['nonce'] !== t.nonce || !(Number(p['exp']) > Date.now() / 1000)) return deny('the id_token does not match this sign-in', 400);
  if (p['email_verified'] !== true || typeof p['email'] !== 'string') return deny('the Google account\'s address is not verified');
  if (g.hd && p['hd'] !== g.hd) return deny('this Google account is not of the organisation this Worker is set up for');
  const email = p['email'].toLowerCase();
  if (!s.presenterEmails.includes(email)) return deny('this address is not one of the presenters');
  return signedIn(s, t.id, {id: t.id, kind: 'email', email}, `/p/${t.id}/presenter`);
}

// --- Cloudflare Access (the application covers /p/*/login only) ------------------------------------------------------------
let certs: {url: string; at: number; keys: (JsonWebKey & {kid?: string})[]} | null = null;
async function accessKeys(url: string, refresh: boolean): Promise<(JsonWebKey & {kid?: string})[]> {
  if (!certs || certs.url !== url || refresh || Date.now() - certs.at > 3600_000) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Access keys: ${r.status}`);
    certs = {url, at: Date.now(), keys: ((await r.json()) as {keys?: (JsonWebKey & {kid?: string})[]}).keys ?? []};
  }
  return certs.keys;
}

export async function accessLogin(req: Request, s: Settings, id: string): Promise<Response> {
  const a = s.access;
  if (!a) return deny('Access sign-in is not set up', 404);
  const jwt = req.headers.get('cf-access-jwt-assertion');
  // the address header alone is never believed: only the signed JWT
  if (!jwt) return deny('no Cloudflare Access token: this sign-in must be behind a Cloudflare Access application for /p/*/login');
  let parts: ReturnType<typeof jwtParts>;
  try { parts = jwtParts(jwt); } catch { return deny('a malformed Access token'); }
  const {h, p, signed, sig} = parts;
  if (h.alg !== 'RS256' || !h.kid) return deny('an Access token not signed with RS256');
  let jwk = (await accessKeys(a.certsUrl, false)).find(k => k.kid === h.kid);
  if (!jwk) jwk = (await accessKeys(a.certsUrl, true)).find(k => k.kid === h.kid); // the keys rotate
  if (!jwk) return deny('an Access token signed with an unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
  let good = false;
  try { good = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(sig), enc.encode(signed)); } catch { good = false; }
  if (!good) return deny('an Access token with a bad signature');
  const now = Date.now() / 1000, aud = Array.isArray(p['aud']) ? p['aud'] : [p['aud']];
  if (!aud.includes(a.aud)) return deny('an Access token for another application');
  if (p['iss'] !== a.iss) return deny('an Access token from another team');
  if (!(Number(p['exp']) > now) || (p['nbf'] !== undefined && Number(p['nbf']) > now + 60)) return deny('an expired Access token');
  if (typeof p['email'] !== 'string') return deny('an Access token without an address (a service token cannot present)');
  const email = p['email'].toLowerCase();
  if (!s.presenterEmails.includes(email)) return deny('this address is not one of the presenters');
  return signedIn(s, id, {id, kind: 'email', email}, `/p/${id}/presenter`);
}
