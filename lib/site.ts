// `svg-diagram site` (ADR 0067): several decks as a static site. The pure part: what site.json says, the slugs, the files' contents
// (_headers, manifest.json, slides.json), and whether DIR may be replaced. No I/O here, and no working directory: every path given is
// absolute (site-diagram.ts makes them so); site-diagram.ts reads, draws and writes.
import path from 'node:path';
import {SVG_CSP} from './present/ui.ts';

export const MANIFEST_VERSION = 1, GENERATOR = 'svg-diagram site';
/** Names a slug may not take: the site's own folder, Cloudflare's, and the Worker's (ADR 0056) should both ever share one domain (D7, D15). */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(['assets', 'cdn-cgi', 'p', 'api', 'auth']);
/** The files at the site's root that `site` writes itself. */
export const ROOT_FILES: ReadonlySet<string> = new Set(['index.html', 'manifest.json', '_headers']);
/** Files an OS leaves in a folder: not taken for the user's own (D10), and replaced with the rest. */
export const OS_FILES: ReadonlySet<string> = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

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
export interface SitePlan {title?: string; decks: SiteDeck[]; extra: SiteExtra[]}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `p` (absolute, or relative to `dir`, which is absolute) as an absolute path. */
const against = (dir: string, p: string): string => path.isAbsolute(p) ? path.normalize(p) : path.join(dir, p);

/** site.json (D5) at the absolute `siteFile`, its relative paths taken from its folder, or every problem with it. */
export function parseSite(raw: unknown, siteFile: string): {ok: true; plan: SitePlan} | {ok: false; errors: string[]} {
  const dir = path.dirname(siteFile), errors: string[] = [], where = path.basename(siteFile);
  if (!isObject(raw)) return {ok: false, errors: [`${where}: needs an object with "decks"`]};
  for (const k of Object.keys(raw)) if (!['title', 'decks', 'extra'].includes(k)) errors.push(`${where}: unknown field "${k}" (title, decks, extra)`);
  if (raw['title'] !== undefined && typeof raw['title'] !== 'string') errors.push(`${where}.title: needs a string`);
  const decks: SiteDeck[] = [];
  if (!Array.isArray(raw['decks']) || raw['decks'].length === 0) errors.push(`${where}.decks: needs a list of one deck or more`);
  else raw['decks'].forEach((d, i) => {
    const place = `${where} decks[${i}]`;
    if (!isObject(d)) { errors.push(`${place}: needs an object with "deck"`); return; }
    for (const k of Object.keys(d)) if (!['deck', 'slug', 'title'].includes(k)) errors.push(`${place}: unknown field "${k}" (deck, slug, title)`);
    if (typeof d['deck'] !== 'string' || !d['deck']) { errors.push(`${place}.deck: needs the deck file's path (relative to ${where})`); return; }
    if (d['slug'] !== undefined && typeof d['slug'] !== 'string') errors.push(`${place}.slug: needs a string`);
    if (d['title'] !== undefined && typeof d['title'] !== 'string') errors.push(`${place}.title: needs a string`);
    decks.push({deck: against(dir, d['deck']), slug: typeof d['slug'] === 'string' ? d['slug'] : undefined, title: typeof d['title'] === 'string' && d['title'] ? d['title'] : undefined, place});
  });
  const extra: SiteExtra[] = [];
  if (raw['extra'] !== undefined) {
    if (!isObject(raw['extra'])) errors.push(`${where}.extra: needs an object {"where in the site": "the file, relative to ${where}"}`);
    else for (const [to, from] of Object.entries(raw['extra'])) {
      const problem = extraPathProblem(to);
      if (problem) errors.push(`${where}.extra["${to}"]: ${problem}`);
      else if (typeof from !== 'string' || !from) errors.push(`${where}.extra["${to}"]: needs the file's path (relative to ${where})`);
      else extra.push({to, from: against(dir, from)});
    }
  }
  return errors.length ? {ok: false, errors} : {ok: true, plan: {title: typeof raw['title'] === 'string' && raw['title'] ? raw['title'] : undefined, decks, extra}};
}

/** Why `to` cannot be where an extra file goes in the site, or null: a plain relative POSIX path, in DIR. */
export function extraPathProblem(to: string): string | null {
  if (!to || to.includes('\\') || to.includes('\0')) return 'needs a relative path with / between folders';
  if (to.startsWith('/') || /^[A-Za-z]:/.test(to)) return 'needs a relative path, not an absolute one';
  const parts = to.split('/');
  if (parts.some(p => p === '' || p === '.' || p === '..')) return 'needs a plain relative path (no "", "." or ".." parts)';
  return null;
}

/** A slug made from a name (D7): lower case, every run of other characters a "-", at most 64 characters; '' when nothing is left. */
export function slugify(name: string): string {
  const s = name.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, 64).replace(/-+$/, '');
}

/** The name a deck's slug is made from: its folder's for a deck.json (the usual name), else the file's without .json. */
export function slugSource(deckFile: string): string {
  const base = path.basename(deckFile);
  return base === 'deck.json' ? path.basename(path.dirname(deckFile)) : base.replace(/\.json$/i, '');
}

export interface SlugResult {slugs: string[]; errors: string[]; warnings: string[]}

/** Every deck's slug (D7): a written one checked strictly, a made one from its name; reserved names and two decks on one slug are errors. */
export function assignSlugs(decks: readonly SiteDeck[]): SlugResult {
  const errors: string[] = [], warnings: string[] = [], slugs: string[] = [], seen = new Map<string, string>();
  decks.forEach((d, i) => {
    let slug: string;
    if (d.slug !== undefined) {
      slug = d.slug;
      if (!SLUG.test(slug)) errors.push(`${d.place}: slug "${slug}" needs 1 to 64 of a-z, 0-9 and "-", starting with a letter or digit`);
    } else {
      const from = slugSource(d.deck), made = slugify(from);
      slug = made || `deck-${i + 1}`;
      const kept = made.replace(/-/g, '').length, had = [...from.normalize('NFKC')].filter(c => !/[\s\-_.]/.test(c)).length;
      if (!made || kept * 2 < had) warnings.push(`${d.place}: the slug "${slug}" was made from 「${from}」; name it yourself with a site.json "slug"`);
    }
    if (RESERVED_SLUGS.has(slug)) errors.push(`${d.place}: slug "${slug}" is reserved (${[...RESERVED_SLUGS].join(', ')}): give another with a site.json "slug"`);
    const before = seen.get(slug);
    if (before) errors.push(`${d.place}: slug "${slug}" is ${before}'s too: give each its own with a site.json "slug"`);
    else seen.set(slug, d.place);
    slugs.push(slug);
  });
  return {slugs, errors, warnings};
}

/** Why an extra file cannot go to `to`, or null: it would be one of the site's own files or inside a deck's folder or assets/ (D10). */
export function extraClash(to: string, slugs: readonly string[]): string | null {
  // compared without case: on macOS and Windows, Index.html is index.html
  const lower = to.toLowerCase(), first = lower.split('/')[0] as string;
  if (ROOT_FILES.has(first)) return `${to.split('/')[0]} is the site's own file`;
  if (first === 'assets' || slugs.includes(first)) return `${to.split('/')[0]}/ is the site's own folder`;
  return null;
}

/** _headers (D8): what a page's <meta> CSP cannot say (frame-ancestors), the slides' own CSP, and the long cache of hashed names. */
export function headersFile(): string {
  return [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  X-Robots-Tag: noindex',
    "  Content-Security-Policy: frame-ancestors 'none'",
    '/:slug/s/*',
    `  Content-Security-Policy: ${SVG_CSP}`,
    '  Cache-Control: public, max-age=31536000, immutable',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n');
}

export interface ManifestDeck {slug: string; title: string; slides: number; cover: string}
export interface Manifest {version: number; generator: string; title: string; files: string[]; decks: ManifestDeck[]}

/** manifest.json (D6): `files` sorted, every path relative to DIR with "/". */
export function manifestJson(title: string, files: readonly string[], decks: readonly ManifestDeck[]): string {
  const m: Manifest = {version: MANIFEST_VERSION, generator: GENERATOR, title, files: [...new Set(files)].sort(), decks: [...decks]};
  return `${JSON.stringify(m, null, 2)}\n`;
}

/** A deck's slides.json (D4): the fields the page reads, as `serve` sends them; the URLs relative to slides.json. No notes (D9). */
export function slidesJson(title: string, slides: readonly {hash: string; title: string; text: string}[]): string {
  return `${JSON.stringify({version: 1, title, slides: slides.map(s => ({url: `s/${s.hash}.svg`, title: s.title, text: s.text}))})}\n`;
}

/** What `site` wrote before, read from DIR/manifest.json; null when it is not (no manifest, or another generator's). */
export function writtenBefore(manifestText: string | null): {files: string[]} | null {
  if (manifestText === null) return null;
  let m: unknown;
  try { m = JSON.parse(manifestText); } catch { return null; }
  if (!isObject(m) || m['generator'] !== GENERATOR || !Array.isArray(m['files']) || !m['files'].every(f => typeof f === 'string')) return null;
  return {files: m['files'] as string[]};
}

/**
 * What in DIR `site` did not write (D10): `entries` are DIR's contents (relative paths with "/", a folder ending in "/"); a folder is fine
 * when it holds a written file, an OS's file is ignored. Anything else was added by someone, and replacing DIR would lose it.
 */
/** Whether DIR's contents are only what an OS leaves (D10): such a DIR is as good as empty. */
export const onlyOsFiles = (entries: readonly string[]): boolean => entries.every(e => !e.endsWith('/') && !e.includes('/') && OS_FILES.has(e));

export function strangers(entries: readonly string[], written: readonly string[]): string[] {
  const files = new Set(written), dirs = new Set<string>();
  for (const f of written) { const parts = f.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join('/')}/`); }
  return entries.filter(e => e.endsWith('/') ? !dirs.has(e) : !files.has(e) && !OS_FILES.has(path.posix.basename(e))).sort();
}

/** Whether `file` is `dir` or inside it (both absolute). */
export function isInside(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
