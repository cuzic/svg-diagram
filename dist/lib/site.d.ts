export declare const MANIFEST_VERSION = 1, GENERATOR = "svg-diagram site";
/** Names a slug may not take: the site's own folder, Cloudflare's, and the Worker's (ADR 0056) should both ever share one domain (D7, D15). */
export declare const RESERVED_SLUGS: ReadonlySet<string>;
/** The files at the site's root that `site` writes itself. */
export declare const ROOT_FILES: ReadonlySet<string>;
/** Files an OS leaves in a folder: not taken for the user's own (D10), and replaced with the rest. */
export declare const OS_FILES: ReadonlySet<string>;
export declare const SLUG: RegExp;
export interface SiteDeck {
    /** The deck file (absolute). */
    deck: string;
    /** As written in site.json (checked strictly), or undefined to make one from the file's name. */
    slug?: string;
    title?: string;
    /** Where it was given, for messages: `site.json decks[1]` or `argument 2`. */
    place: string;
}
export interface SiteExtra {
    /** Where it goes in DIR (a relative POSIX path). */
    to: string;
    /** The file (absolute). */
    from: string;
}
export interface SitePlan {
    title?: string;
    decks: SiteDeck[];
    extra: SiteExtra[];
}
/** site.json (D5) at the absolute `siteFile`, its relative paths taken from its folder, or every problem with it. */
export declare function parseSite(raw: unknown, siteFile: string): {
    ok: true;
    plan: SitePlan;
} | {
    ok: false;
    errors: string[];
};
/** Why `to` cannot be where an extra file goes in the site, or null: a plain relative POSIX path, in DIR. */
export declare function extraPathProblem(to: string): string | null;
/** A slug made from a name (D7): lower case, every run of other characters a "-", at most 64 characters; '' when nothing is left. */
export declare function slugify(name: string): string;
/** The name a deck's slug is made from: its folder's for a deck.json (the usual name), else the file's without .json. */
export declare function slugSource(deckFile: string): string;
export interface SlugResult {
    slugs: string[];
    errors: string[];
    warnings: string[];
}
/** Every deck's slug (D7): a written one checked strictly, a made one from its name; reserved names and two decks on one slug are errors. */
export declare function assignSlugs(decks: readonly SiteDeck[]): SlugResult;
/** Why an extra file cannot go to `to`, or null: it would be one of the site's own files or inside a deck's folder or assets/ (D10). */
export declare function extraClash(to: string, slugs: readonly string[]): string | null;
/** _headers (D8): what a page's <meta> CSP cannot say (frame-ancestors), the slides' own CSP, and the long cache of hashed names. */
export declare function headersFile(): string;
export interface ManifestDeck {
    slug: string;
    title: string;
    slides: number;
    cover: string;
}
export interface Manifest {
    version: number;
    generator: string;
    title: string;
    files: string[];
    decks: ManifestDeck[];
}
/** manifest.json (D6): `files` sorted, every path relative to DIR with "/". */
export declare function manifestJson(title: string, files: readonly string[], decks: readonly ManifestDeck[]): string;
/** A deck's slides.json (D4): the fields the page reads, as `serve` sends them; the URLs relative to slides.json. No notes (D9). */
export declare function slidesJson(title: string, slides: readonly {
    hash: string;
    title: string;
    text: string;
}[]): string;
/** What `site` wrote before, read from DIR/manifest.json; null when it is not (no manifest, or another generator's). */
export declare function writtenBefore(manifestText: string | null): {
    files: string[];
} | null;
/**
 * What in DIR `site` did not write (D10): `entries` are DIR's contents (relative paths with "/", a folder ending in "/"); a folder is fine
 * when it holds a written file, an OS's file is ignored. Anything else was added by someone, and replacing DIR would lose it.
 */
/** Whether DIR's contents are only what an OS leaves (D10): such a DIR is as good as empty. */
export declare const onlyOsFiles: (entries: readonly string[]) => boolean;
export declare function strangers(entries: readonly string[], written: readonly string[]): string[];
/** Whether `file` is `dir` or inside it (both absolute). */
export declare function isInside(file: string, dir: string): boolean;
