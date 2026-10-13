// Markdown that points at diagram sources: `![alt](./flow.diagram.ts)` becomes the figure.
//   expandMarkdown(text, {file, ...})  →  the Markdown with each figure replaced, plus the SVGs it drew
// An image whose target ends in `.diagram.ts` is a diagram source (the module `svg-diagram build` takes, path relative to the
// Markdown file). Anything inside a fenced block or an inline code span is left alone, so a page can show the syntax.
//   mode 'file'   (default)  the SVG is returned in `files` and the image points at it — the Markdown stays portable
//   mode 'inline'            the <svg> itself replaces the image (as an HTML block), for renderers that cannot load files
//   render 'html'            the figure as HTML/CSS (what `build --html` writes) replaces the image; it is always inline
// `![alt](flow.diagram.ts#html)` / `#svg` picks the output for that one figure.
// Nothing is written here; the CLI (`svg-diagram md`) writes `files` and the Markdown. A figure that fails verification
// is reported in `problems` and its image is left as written.
import path from 'node:path';
import {renderSource} from './render-source.ts';
import {diagramTarget, figureName, noBlankLines, type Render} from './markdown-target.ts';

export interface ExpandOptions {
  /** The Markdown file's path — sources are resolved from its directory. */
  file: string;
  mode?: 'file' | 'inline';
  /** 'svg' (default) or 'html' (HTML/CSS, always inline). A `#svg` / `#html` on an image's target wins. */
  render?: Render;
  /** Where the SVGs will be written, relative to the Markdown file's directory (default: svg). Used for the image targets. */
  svgDir?: string;
  /** Passed to renderSource. */
  fresh?: boolean;
}

export interface Figure {
  /** The source, absolute. */
  source: string;
  /** The SVG's file name inside svgDir (mode 'file'). */
  name: string;
  svg: string;
  html: string;
  warnings: string[];
}

export interface ExpandResult {
  markdown: string;
  figures: Figure[];
  /** `source: problem` — one per failed check, or per source that did not load. */
  problems: string[];
}

const IMAGE = /!\[([^\]\n]*)\]\(\s*<?([^)\s>]+\.diagram\.ts(?:#(?:svg|html))?)>?(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/g;

/** The same text with every inline code span's characters blanked, so a match inside one can be told apart by offset. */
function maskCode(line: string): string {
  return line.replace(/(`+)(.+?)\1/g, m => ' '.repeat(m.length));
}

export async function expandMarkdown(text: string, opts: ExpandOptions): Promise<ExpandResult> {
  const dir = path.dirname(path.resolve(opts.file));
  const svgDir = (opts.svgDir ?? 'svg').replace(/\/+$/, '');
  const mode = opts.mode ?? 'file';
  const figures = new Map<string, Figure>();
  const used = new Set<string>();
  const problems: string[] = [];
  const failed = new Set<string>();

  const draw = async (src: string): Promise<Figure | undefined> => {
    if (figures.has(src)) return figures.get(src);
    if (failed.has(src)) return undefined;
    const label = path.relative(dir, src) || src;
    try {
      const r = await renderSource(src, {fresh: opts.fresh, html: true});
      if (!r.ok) {
        for (const p of r.problems) problems.push(`${label}: ${p}`);
        failed.add(src);
        return undefined;
      }
      let name = figureName(src) + '.svg';
      for (let n = 2; used.has(name); n++) name = `${figureName(src)}-${n}.svg`;
      used.add(name);
      const f: Figure = {source: src, name, svg: r.svg, html: r.html ?? '', warnings: r.warnings};
      figures.set(src, f);
      return f;
    } catch (e) {
      problems.push(`${label}: ${(e as Error).message}`);
      failed.add(src);
      return undefined;
    }
  };

  const lines = text.split('\n');
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(ln);
    if (fence) { if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !ln.slice(m[0].length).trim()) fence = undefined; continue; }
    if (m) { fence = m[1]; continue; }
    const masked = maskCode(ln);
    const hits = [...masked.matchAll(IMAGE)];
    if (!hits.length) continue;
    let out = '';
    let at = 0;
    for (const h of hits) {
      const real = ln.slice(h.index, h.index + h[0].length);
      const [, alt, target, t1, t2] = IMAGE_ONE(real);
      out += ln.slice(at, h.index);
      at = h.index + h[0].length;
      const t = diagramTarget(target);
      if (!t) { out += real; continue; }
      const f = await draw(path.resolve(dir, decodeURI(t.file)));
      if (!f) { out += real; continue; }
      const title = t1 ?? t2;
      const render = t.render ?? opts.render ?? 'svg';
      out += render === 'html'
        ? `\n\n${noBlankLines(f.html)}\n\n`
        : mode === 'inline'
        ? inlineSvg(f.svg, alt)
        : `![${alt}](${svgDir}/${f.name}${title !== undefined ? ` "${title}"` : ''})`;
    }
    lines[i] = out + ln.slice(at);
  }
  return {markdown: lines.join('\n'), figures: [...figures.values()], problems};
}

function IMAGE_ONE(s: string): string[] {
  return new RegExp(IMAGE.source).exec(s)!;
}

/** The <svg> as an HTML block: no XML prolog, its own paragraph (blank lines around it), the alt text as a label. */
export function inlineSvg(svg: string, alt: string): string {
  let s = svg.replace(/^\s*<\?xml[^>]*\?>\s*/, '').trim();
  // A blank line ends a Markdown HTML block, so the picture must not contain one.
  s = s.replace(/\n\s*\n/g, '\n');
  if (alt && !/\brole=/.test(s.slice(0, s.indexOf('>')))) s = s.replace(/^<svg\b/, `<svg role="img" aria-label="${escAttr(alt)}"`);
  return `\n\n${s}\n\n`;
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
