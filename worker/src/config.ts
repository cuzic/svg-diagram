// The Worker's settings (ADR 0056 D16): `vars` of wrangler.jsonc and the secrets, read once per request and checked. The person who deploys
// chooses them; the defaults are written here. A missing or contradictory setting stops the Worker from answering (an empty 503 for a viewer;
// what is wrong goes to the log and to `--publish`, which holds PUBLISH_TOKEN), so a half-configured Worker never runs half-secured.

/** core's MAX_SLIDES (lib/deck-spec.ts, which pulls in every spec part: not bundled here); test/worker.test.ts keeps them equal. */
export const CORE_MAX_SLIDES = 300;

export interface Env {
  PRESENTATION: DurableObjectNamespace;
  MAX_CONNECTIONS?: string; RETENTION_DAYS?: string; MAX_SLIDES?: string; MAX_SLIDE_BYTES?: string; MAX_DECK_BYTES?: string;
  PRESENTER_LOGIN?: string; PRESENTER_EMAILS?: string;
  ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; GOOGLE_HD?: string; LOCATION_HINT?: string;
  PUBLISH_TOKEN?: string; SESSION_SECRET?: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string;
  /** For tests only: where Google and Access are (a local fake). Unset in a real deployment. */
  GOOGLE_AUTH_URL?: string; GOOGLE_TOKEN_URL?: string; GOOGLE_ISS?: string; ACCESS_CERTS_URL?: string; ACCESS_ISS?: string;
}

export interface Settings {
  maxConnections: number; retentionDays: number; maxSlides: number; maxSlideBytes: number; maxDeckBytes: number;
  login: 'none' | 'access' | 'google';
  /** Lower-cased. */
  presenterEmails: string[];
  access: {aud: string; iss: string; certsUrl: string} | null;
  google: {clientId: string; clientSecret: string; hd: string; authUrl: string; tokenUrl: string; iss: string} | null;
  publishToken: string; sessionSecret: string;
  locationHint: string | undefined;
}

const MiB = 1024 * 1024;
const HINTS = new Set(['wnam', 'enam', 'sam', 'weur', 'eeur', 'apac', 'oc', 'afr', 'me']);

/** The settings, or every problem with them. */
export function readSettings(env: Env): {ok: true; settings: Settings} | {ok: false; problems: string[]} {
  const problems: string[] = [];
  const int = (name: keyof Env, fallback: number, min: number, max: number): number => {
    const raw = env[name] as string | undefined;
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) { problems.push(`${name} must be a whole number from ${min} to ${max} (got ${raw})`); return fallback; }
    return n;
  };
  const maxConnections = int('MAX_CONNECTIONS', 500, 1, 32_000);
  const retentionDays = int('RETENTION_DAYS', 30, 1, 3650);
  const maxSlides = int('MAX_SLIDES', 300, 1, CORE_MAX_SLIDES);
  const maxSlideBytes = int('MAX_SLIDE_BYTES', 4 * MiB, 1024, 32 * MiB);
  const maxDeckBytes = int('MAX_DECK_BYTES', 16 * MiB, 1024, 100 * MiB);
  if (maxDeckBytes < maxSlideBytes) problems.push('MAX_DECK_BYTES must be at least MAX_SLIDE_BYTES');
  const login = (env.PRESENTER_LOGIN || 'none') as Settings['login'];
  if (!['none', 'access', 'google'].includes(login)) problems.push(`PRESENTER_LOGIN must be none, access or google (got ${env.PRESENTER_LOGIN})`);
  const presenterEmails = (env.PRESENTER_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (login !== 'none' && !presenterEmails.length) problems.push(`PRESENTER_LOGIN is ${login}, so PRESENTER_EMAILS must name at least one address`);
  if (presenterEmails.some(e => !/^[^@\s]+@[^@\s]+$/.test(e))) problems.push('PRESENTER_EMAILS must be email addresses separated by commas');
  let access: Settings['access'] = null, google: Settings['google'] = null;
  if (login === 'access') {
    const team = env.ACCESS_TEAM_DOMAIN ?? '';
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) && !env.ACCESS_CERTS_URL) problems.push(`ACCESS_TEAM_DOMAIN must look like <team>.cloudflareaccess.com (got ${team || 'nothing'})`);
    if (!env.ACCESS_AUD) problems.push('PRESENTER_LOGIN is access, so ACCESS_AUD (the Application Audience tag of the Access application) must be set');
    access = {aud: env.ACCESS_AUD ?? '', iss: env.ACCESS_ISS || `https://${team}`, certsUrl: env.ACCESS_CERTS_URL || `https://${team}/cdn-cgi/access/certs`};
  }
  if (login === 'google') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) problems.push('PRESENTER_LOGIN is google, so the secrets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
    google = {clientId: env.GOOGLE_CLIENT_ID ?? '', clientSecret: env.GOOGLE_CLIENT_SECRET ?? '', hd: env.GOOGLE_HD ?? '',
      authUrl: env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token', iss: env.GOOGLE_ISS || 'https://accounts.google.com'};
  }
  if (!env.PUBLISH_TOKEN || env.PUBLISH_TOKEN.length < 32) problems.push('the secret PUBLISH_TOKEN must be set, at least 32 characters (wrangler secret put PUBLISH_TOKEN)');
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) problems.push('the secret SESSION_SECRET must be set, at least 32 characters (wrangler secret put SESSION_SECRET)');
  const locationHint = env.LOCATION_HINT || undefined;
  if (locationHint && !HINTS.has(locationHint)) problems.push(`LOCATION_HINT must be one of ${[...HINTS].join(', ')} (got ${locationHint})`);
  if (problems.length) return {ok: false, problems};
  return {ok: true, settings: {maxConnections, retentionDays, maxSlides, maxSlideBytes, maxDeckBytes, login, presenterEmails, access, google,
    publishToken: env.PUBLISH_TOKEN ?? '', sessionSecret: env.SESSION_SECRET ?? '', locationHint}};
}
