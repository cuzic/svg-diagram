// Who may ask the local server what (ADR 0056 D9), as pure functions over the request's headers: the Host it was sent to (a page of another
// site that renamed its DNS to this machine is refused), and whether a request comes from this server's own pages (Origin, Sec-Fetch-Site).

/** The Host headers this server answers: each allowed name or address with the port, an IPv6 address in brackets. */
export function allowedHosts(names: readonly string[], port: number): Set<string> {
  return new Set(names.map(n => `${n.includes(':') && !n.startsWith('[') ? `[${n}]` : n}:${port}`.toLowerCase()));
}

export function hostOk(host: string | undefined, allowed: ReadonlySet<string>): boolean {
  return host !== undefined && allowed.has(host.toLowerCase());
}

/** A state-changing request (POST): only from this server's own pages. */
export function postOk(h: {host?: string; origin?: string}): boolean {
  return h.origin !== undefined && h.host !== undefined && h.origin.toLowerCase() === `http://${h.host.toLowerCase()}`;
}

/**
 * The event stream (GET): a same-origin EventSource sends no Origin, so none is accepted, or this server's own; and where the browser says
 * where the request comes from (Sec-Fetch-Site), it must be this origin (another port of the same machine is `same-site`, and refused).
 */
export function streamOk(h: {host?: string; origin?: string; secFetchSite?: string}): boolean {
  if (h.origin !== undefined && !postOk(h)) return false;
  return h.secFetchSite === undefined || h.secFetchSite === 'same-origin' || h.secFetchSite === 'none';
}

/** The value of cookie `name` in a Cookie header. */
export function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(/;\s*/)) if (part.startsWith(name + '=')) return part.slice(name.length + 1);
  return undefined;
}

/** Whether two strings are equal, in a time that does not depend on where they differ. */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** The headers of a slide SVG (ADR 0056 D3): even opened directly in a tab, nothing in it runs or loads. */
export const SVG_HEADERS: Record<string, string> = {
  'content-type': 'image/svg+xml; charset=utf-8',
  'content-security-policy': "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  'x-content-type-options': 'nosniff',
  'cache-control': 'public, max-age=31536000, immutable',
};

/** The headers of a page: its own script and stylesheet only, no framing by another site, not indexed. */
export const PAGE_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
};
