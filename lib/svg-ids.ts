// `build --id-prefix` (ADR 0012 D2): give every id of an SVG or HTML figure a prefix, and every reference to it the same one,
// so several figures can sit on one page without sharing an id. A pure post-process on the text that is about to be written;
// emit.ts / emit-html.ts do not know about it. The three older prefixers (raster.embedSvg, markdown-target.inlineSvg / htmlFigure)
// have forms of their own and are left alone.
//
// What changes: id="…", url(#…), href="#…" / xlink:href="#…", aria-labelledby / aria-describedby (several, space-separated),
// and the `#id` selectors of a <style>. What does not: <metadata id="svg-diagram"> — `check --drift` and `build --stale` read it by that id.

const KEEP_TAG = 'metadata';

/** The prefix a source gets: one source `p`, several `p-<basename>`; both are made safe to sit in an id. */
export function idPrefixFor(prefix: string, basename: string | null): string {
  const safe = (s: string) => s.replace(/[^\w-]+/g, '-');
  const p = safe(prefix).replace(/-+$/, ''); // `fig1-` and `fig1` are the same prefix, as for the API
  return basename === null ? p : `${p}-${safe(basename)}`;
}

/** What the two rewriters share: the ids of the markup (not `<metadata>`'s), their new names, and `url(#id)` in a text. */
function scoped(markup: string, prefix: string, rootId?: string) {
  const ids = new Set<string>();
  for (const m of markup.matchAll(/<([A-Za-z][\w:-]*)\b([^>]*)>/g)) {
    const id = m[1] === KEEP_TAG ? undefined : /\sid="([^"]+)"/.exec(m[2] ?? '')?.[1];
    if (id) ids.add(id);
  }
  const rename = (id: string) => id === rootId ? prefix : `${prefix}-${id}`;
  const ref = (id: string) => ids.has(id) ? rename(id) : id;
  const urls = (t: string) => t.replace(/url\((['"]?)#([^)'"\s]+)\1\)/g, (_m, q: string, id: string) => `url(${q}#${ref(id)}${q})`);
  return {ids, rename, ref, urls};
}

/**
 * `<prefix>-<id>` for every id in the tags of `markup` (and every reference to it in an attribute): the SVG form of a figure, whose `<style>`
 * has no id in it. Text content is not touched (a label that reads `url(#x)` stays as written).
 */
export function prefixTagIds(markup: string, prefix: string, rootId?: string): string {
  const {ids, rename, ref, urls} = scoped(markup, prefix, rootId);
  if (ids.size === 0) return markup;
  return markup.replace(/<([A-Za-z][\w:-]*)\b([^>]*)>/g, (all, name: string, attrs: string) => name === KEEP_TAG ? all :
    `<${name}${attrs.replace(/(\sid=")([^"]+)/, (_m, a: string, id: string) => a + rename(id))
      // url(#id) only where an attribute takes a reference: never in aria-label or any other text
      .replace(/\s(?:fill|stroke|clip-path|mask|filter|style|marker-\w+)="[^"]*"/g, urls)
      .replace(/((?:xlink:)?href=")#([^"]*)/g, (_m, a: string, id: string) => `${a}#${ref(id)}`)
      .replace(/(\saria-(?:labelledby|describedby)=")([^"]*)/g, (_m, a: string, v: string) => a + v.split(/\s+/).map(ref).join(' '))}>`);
}

/**
 * The same for a figure that may have a `<style>` (the HTML form): the `#id` selectors and `url(#id)` of the style follow too.
 * `rootId`, when it is an id of the markup, becomes `prefix` itself instead (the HTML figure's root is named by a content hash).
 */
export function prefixSvgIds(markup: string, prefix: string, opts: {rootId?: string} = {}): string {
  const {ref, urls} = scoped(markup, prefix, opts.rootId);
  const styled = markup.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (_m, open: string, css: string, close: string) =>
    open + urls(css).replace(/([^{}]+)\{/g, (rule: string, sel: string) =>
      sel.trimStart().startsWith('@') ? rule : sel.replace(/#([A-Za-z_][\w-]*)/g, (_s, id: string) => `#${ref(id)}`) + '{') + close);
  return prefixTagIds(styled, prefix, opts.rootId);
}

/** Options for a figure that is pasted into a page as inline markup (ADR 0012 D2 as an option of the render functions). */
export interface EmbedOptions {
  /** Every id of the figure, and every reference to it, becomes `<idPrefix>-<id>` (a trailing `-` of the prefix is not doubled; letters, digits, `_` and `-` only). `'auto'` is `sd` and a hash of the figure's text, as `build --id-prefix auto` is. */
  idPrefix?: string;
  /** Inline output: no `width` / `height` on the root `<svg>`, only the viewBox, so CSS sizes the figure. */
  inline?: boolean;
}

const PREFIX_NAME = /^[A-Za-z_][\w-]*$/;

/** A pure 32-bit FNV-1a hash of a text as 8 hex digits (no node:crypto: the browser entry uses it too). */
function hash8(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** The prefix `idPrefix: 'auto'` / `--id-prefix auto` gives a figure: `sd` and a hash of its text. */
export const autoIdPrefix = (text: string): string => `sd${hash8(text)}`;

/** Why `prefix` cannot be an id prefix, or null when it can ('auto' is fine: it is resolved per figure). */
export function idPrefixProblem(prefix: string): string | null {
  return typeof prefix === 'string' && PREFIX_NAME.test(prefix.replace(/-+$/, '')) ? null : `idPrefix "${prefix}": use letters, digits, _ -, not starting with a digit (e.g. "fig1-")`;
}

/** The prefix as `prefixSvgIds` takes it: `fig1` and `fig1-` are the same prefix. Throws for a text that cannot start an id. */
export function normalizeIdPrefix(prefix: string): string {
  const problem = idPrefixProblem(prefix);
  if (problem) throw new Error(problem);
  return prefix.replace(/-+$/, '');
}

const resolvePrefix = (prefix: string, text: string): string => prefix === 'auto' ? autoIdPrefix(text) : normalizeIdPrefix(prefix);

/** `<svg>` text with `opts` applied: the id prefix first, then the inline form. No option: the text as it is. */
export function prepareForEmbedding(svg: string, opts: EmbedOptions): string {
  let s = svg;
  if (opts.idPrefix !== undefined) {
    const prefix = resolvePrefix(opts.idPrefix, svg);
    s = prefixTagIds(s, prefix);
  }
  if (opts.inline) {
    s = s.replace(/<svg\b[^>]*>/, root => root.replace(/\s(?:width|height)="[^"]*"/g, ''));
  }
  return s;
}

/** The HTML form of a figure: its ids get the prefix, and its root (named by a content hash) is named by the prefix itself, as `build --id-prefix` does. */
export function prepareHtmlForEmbedding(html: string, opts: EmbedOptions): string {
  if (opts.idPrefix === undefined) return html;
  return prefixSvgIds(html, resolvePrefix(opts.idPrefix, html), {rootId: /<div id="(sd-[0-9a-f]+)" class="sd"/.exec(html)?.[1]});
}
