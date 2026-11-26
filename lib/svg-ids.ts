// `build --id-prefix` (ADR 0012 D2): give every id of an SVG or HTML figure a prefix, and every reference to it the same one,
// so several figures can sit on one page without sharing an id. A pure post-process on the text that is about to be written;
// emit.ts / emit-html.ts do not know about it. The three older prefixers (raster.embedSvg, markdown-target.inlineSvg / htmlFigure)
// have forms of their own and are left alone.
//
// What changes: id="…", url(#…), href="#…" / xlink:href="#…", aria-labelledby / aria-describedby (several, space-separated),
// and the `#id` selectors of a <style>. What does not: <metadata id="svg-diagram"> — `check --drift` and `build --stale` read it by that id.

const KEEP_TAGS: ReadonlySet<string> = new Set(['metadata']);

/** The prefix a source gets: one source `p`, several `p-<basename>`; both are made safe to sit in an id. */
export function idPrefixFor(prefix: string, basename: string | null): string {
  const safe = (s: string) => s.replace(/[^\w.-]+/g, '-');
  return basename === null ? safe(prefix) : `${safe(prefix)}-${safe(basename)}`;
}

/**
 * `<prefix>-<id>` for every id in `markup` (and every reference to it). `rootId`, when it is an id of the markup, becomes
 * `prefix` itself instead (the HTML figure's root is named by a content hash; the prefix is the better name).
 */
export function prefixSvgIds(markup: string, prefix: string, opts: {rootId?: string} = {}): string {
  const rename = (id: string) => id === opts.rootId ? prefix : `${prefix}-${id}`;
  const ids = new Set<string>();
  for (const m of markup.matchAll(/<([A-Za-z][\w:-]*)\b([^>]*)>/g)) {
    if (KEEP_TAGS.has(m[1] ?? '')) continue;
    const id = /\sid="([^"]+)"/.exec(m[2] ?? '')?.[1];
    if (id) ids.add(id);
  }
  if (ids.size === 0) return markup;
  let s = markup.replace(/<([A-Za-z][\w:-]*)\b([^>]*)>/g, (tag, name: string, attrs: string) => {
    if (KEEP_TAGS.has(name)) return tag;
    return `<${name}${attrs.replace(/(\sid=")([^"]+)(")/, (_m, a: string, id: string, c: string) => a + rename(id) + c)}>`;
  });
  s = s.replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g, (m, q: string, id: string) => ids.has(id) ? `url(${q}#${rename(id)}${q})` : m);
  s = s.replace(/((?:xlink:)?href=")#([^"]*)(")/g, (m, a: string, id: string, c: string) => ids.has(id) ? `${a}#${rename(id)}${c}` : m);
  s = s.replace(/(\saria-(?:labelledby|describedby)=")([^"]*)(")/g, (_m, a: string, v: string, c: string) =>
    a + v.split(/\s+/).map(t => ids.has(t) ? rename(t) : t).join(' ') + c);
  s = s.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (_m, open: string, css: string, close: string) =>
    open + css.replace(/([^{}]+)\{/g, (rule: string, sel: string) => {
      if (sel.trimStart().startsWith('@')) return rule;
      return sel.replace(/#([A-Za-z_][\w-]*)/g, (m, id: string) => ids.has(id) ? `#${rename(id)}` : m) + '{';
    }) + close);
  return s;
}

/** Options for a figure that is pasted into a page as inline markup (ADR 0012 D2 as an option of the render functions). */
export interface EmbedOptions {
  /** Every id of the figure, and every reference to it, becomes `<idPrefix>-<id>` (a trailing `-` of the prefix is not doubled). Names the figure in one page. */
  idPrefix?: string;
  /** Inline output: no `<?xml?>` declaration and no `width` / `height` on the root `<svg>`, only the viewBox, so CSS sizes the figure. */
  inline?: boolean;
}

const PREFIX_NAME = /^[A-Za-z_][\w.-]*$/;

/** The prefix as `prefixSvgIds` takes it: `fig1-` and `fig1` are the same prefix. Throws for a text that cannot start an id. */
export function normalizeIdPrefix(prefix: string): string {
  const name = prefix.replace(/-+$/, '');
  if (!PREFIX_NAME.test(name)) throw new Error(`idPrefix must be a name usable in an id (letters, digits, _ . -; not starting with a digit), got "${prefix}". Use e.g. "fig1-"`);
  return name;
}

/** `<svg>` text with `opts` applied: the id prefix first, then the inline form. No option: the text as it is. */
export function prepareForEmbedding(svg: string, opts: EmbedOptions): string {
  let s = svg;
  if (opts.idPrefix !== undefined) s = prefixSvgIds(s, normalizeIdPrefix(opts.idPrefix));
  if (opts.inline) {
    s = s.replace(/^\s*<\?xml[^>]*\?>\s*/, '');
    s = s.replace(/<svg\b[^>]*>/, root => root.replace(/\s(?:width|height)="[^"]*"/g, ''));
  }
  return s;
}

/** The HTML form of a figure: its ids get the prefix, and its root (named by a content hash) is named by the prefix itself, as `build --id-prefix` does. */
export function prepareHtmlForEmbedding(html: string, opts: EmbedOptions): string {
  if (opts.idPrefix === undefined) return html;
  return prefixSvgIds(html, normalizeIdPrefix(opts.idPrefix), {rootId: /<div id="(sd-[0-9a-f]+)" class="sd"/.exec(html)?.[1]});
}
