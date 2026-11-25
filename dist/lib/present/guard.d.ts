/** The Host headers this server answers: each allowed name or address with the port, an IPv6 address in brackets. */
export declare function allowedHosts(names: readonly string[], port: number): Set<string>;
export declare function hostOk(host: string | undefined, allowed: ReadonlySet<string>): boolean;
/** A state-changing request (POST): only from this server's own pages. */
export declare function postOk(h: {
    host?: string;
    origin?: string;
}): boolean;
/**
 * The event stream (GET): a same-origin EventSource sends no Origin, so none is accepted, or this server's own; and where the browser says
 * where the request comes from (Sec-Fetch-Site), it must be this origin (another port of the same machine is `same-site`, and refused).
 */
export declare function streamOk(h: {
    host?: string;
    origin?: string;
    secFetchSite?: string;
}): boolean;
/** The value of cookie `name` in a Cookie header. */
export declare function cookieValue(header: string | undefined, name: string): string | undefined;
/** Whether two strings are equal, in a time that does not depend on where they differ. */
export declare function sameSecret(a: string, b: string): boolean;
/** The headers of a slide SVG (ADR 0056 D3): even opened directly in a tab, nothing in it runs or loads. */
export declare const SVG_HEADERS: Record<string, string>;
/** The headers of a page: its own script and stylesheet only, no framing by another site, not indexed. */
export declare const PAGE_HEADERS: Record<string, string>;
