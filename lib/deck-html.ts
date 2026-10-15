// `svg-diagram deck` (ADR 0018 unit B): several figures in one self-contained HTML document. A pure function of its inputs
// (no I/O, no clock, no randomness — ADR 0007), so the same inputs give the same bytes.
//
// Each figure is a `<section id="sN">` holding its <svg>, with: ids prefixed `sN-<name>` (prefixSvgIds, ADR 0012 D2), the
// <metadata> dropped (a copy per figure would repeat one id, and would carry the source path out of the file), and the figure's
// <style> taken out of the body: its rules are scoped to `#sN` (scope-style.ts) and joined — in the figures' order — to the viewer's
// CSS in the document's one <style>. One <style> and one <script> is what lets `--csp` name them by two hashes.
import {createHash} from 'node:crypto';
import {idPrefixFor, prefixSvgIds} from './svg-ids.ts';
import {scopeRules} from './scope-style.ts';
import {escAttr} from './markdown-target.ts';

export interface DeckSlide {
  /** The source's basename (no extension): the URL hash name and the last resort for the slide's name. */
  name: string;
  /** The figure's SVG as `renderSource` returns it, or an exported .svg read from disk. */
  svg: string;
  /** The slide's name for assistive technology. Default: the figure's own <title>, then `name`. */
  title?: string;
}

export interface DeckOptions {
  /** The viewer's CSS (unit C) and script (unit C: state.js + viewer.js). Embedded as they are; neither may contain its closing tag. */
  css: string;
  js: string;
  /** The document's <title> and the label of the viewer. Default `svg-diagram deck`. */
  title?: string;
  lang?: string;
  /** Emit a `<meta http-equiv="Content-Security-Policy">` that allows exactly the one <style> and the one <script> (by SHA-256). */
  csp?: boolean;
  /** Columns of the overview, as the custom property `--deck-cols` on `#deck` (the stylesheet decides what to do without it). */
  cols?: number;
}

const escText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescXml = (s: string): string => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const sha256 = (s: string): string => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

/** The text of the figure's `<title>` (what a doc-sized figure is named by), or undefined. */
export function svgTitle(svg: string): string | undefined {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/.exec(svg);
  const t = m ? unescXml(m[1]).trim() : '';
  return t === '' ? undefined : t;
}

/** The hash name of a slide: a file name made safe to sit in an id and in a URL (`#flow`). */
export function slideHashName(name: string): string {
  return name.replace(/[^\w.-]+/g, '-');
}

/**
 * What stops an SVG being self-contained: an `href` / `src` that is not a data URI or a `#fragment`, an `@import`, a `url(...)` that is
 * not `#fragment` or `data:`. (The `xmlns` namespace names are not references.) Empty when there is none.
 */
export function externalRefs(svg: string): string[] {
  const found = new Set<string>();
  for (const m of svg.matchAll(/\s(?:xlink:)?(?:href|src)\s*=\s*"([^"]*)"/g)) if (!/^(#|data:)/i.test(m[1].trim())) found.add(m[1]);
  for (const m of svg.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)/g)) found.add(m[1]);
  for (const m of svg.matchAll(/url\(\s*['"]?([^'")]*)['"]?\s*\)/g)) if (!/^(#|data:)/i.test(m[1].trim())) found.add(m[1]);
  return [...found];
}

function sizeOf(svg: string): {w: number; h: number} | undefined {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const num = (a: string) => { const v = Number(new RegExp(`\\s${a}="([\\d.]+)(?:px)?"`).exec(root)?.[1]); return Number.isFinite(v) && v > 0 ? v : undefined; };
  const w = num('width'), h = num('height');
  if (w && h) return {w, h};
  const vb = /\sviewBox="\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)\s*"/.exec(root);
  return vb && Number(vb[1]) > 0 && Number(vb[2]) > 0 ? {w: Number(vb[1]), h: Number(vb[2])} : undefined;
}

/** One figure made ready to sit in the document: its <style> rules (scoped to `#<id>`) are returned apart from its markup. */
function prepare(slide: DeckSlide, n: number): {id: string; svg: string; css: string; dark: boolean} {
  const id = `s${n}`;
  let s = slide.svg.replace(/^\s*<\?xml[^>]*\?>\s*/, '').trim();
  s = s.replace(/<metadata\b[^>]*\/>\s*|<metadata\b[\s\S]*?<\/metadata>\s*/g, '');
  s = prefixSvgIds(s, idPrefixFor(id, slide.name));
  const rules: string[] = [];
  s = s.replace(/<style\b[^>]*>([\s\S]*?)<\/style>\s*/g, (_m, css: string) => { rules.push(scopeRules(css, id)); return ''; });
  const dark = /^<svg\b[^>]*\sdata-appearance="dark"/.test(s);
  return {id, svg: s, css: rules.join(''), dark};
}

/** The deck: one HTML document holding every slide, the viewer's CSS and script, and (with `csp`) a policy that admits only those two blocks. */
export function buildDeck(slides: readonly DeckSlide[], opts: DeckOptions): string {
  if (/<\/style/i.test(opts.css)) throw new Error('the viewer CSS must not contain </style');
  if (/<\/script/i.test(opts.js)) throw new Error('the viewer script must not contain </script');
  const title = opts.title ?? 'svg-diagram deck';
  const total = slides.length;
  const parts = slides.map((slide, i) => prepare(slide, i + 1));
  const sizes = slides.map(s => sizeOf(s.svg)).filter((x): x is {w: number; h: number} => x !== undefined);
  const page = sizes.length ? `\n@media print { @page { size: ${Math.max(...sizes.map(z => z.w))}px ${Math.max(...sizes.map(z => z.h))}px; margin: 0 } }` : '';
  const cols = opts.cols && opts.cols >= 1 ? `\n#deck { --deck-cols: ${Math.floor(opts.cols)} }` : '';
  const style = `${opts.css}${cols}${parts.map(p => p.css).join('')}${page}\n`;
  const script = opts.js;

  const sections = parts.map((p, i) => {
    const slide = slides[i];
    const label = `${i + 1} / ${total}: ${slide.title ?? svgTitle(slide.svg) ?? slide.name}`;
    return `  <section id="${p.id}" class="slide${p.dark ? ' slide-dark' : ''}" role="group" aria-roledescription="slide" aria-label="${escAttr(label)}" data-name="${escAttr(slideHashName(slide.name))}">\n${p.svg}\n  </section>`;
  });

  const csp = opts.csp
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${sha256(style)}; script-src ${sha256(script)}; img-src data:">\n`
    : '';
  return `<!doctype html>
<html lang="${escAttr(opts.lang ?? 'ja')}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${csp}<title>${escText(title)}</title>
<style>${style}</style>
</head>
<body>
<main id="deck" tabindex="0" aria-label="${escAttr(title)}">
${sections.join('\n')}
</main>
<script>${script}</script>
</body>
</html>
`;
}
