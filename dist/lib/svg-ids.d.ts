/** The prefix a source gets: one source `p`, several `p-<basename>`; both are made safe to sit in an id. */
export declare function idPrefixFor(prefix: string, basename: string | null): string;
/**
 * `<prefix>-<id>` for every id in `markup` (and every reference to it). `rootId`, when it is an id of the markup, becomes
 * `prefix` itself instead (the HTML figure's root is named by a content hash; the prefix is the better name).
 */
export declare function prefixSvgIds(markup: string, prefix: string, opts?: {
    rootId?: string;
}): string;
