// Markdown that points at diagram sources: `![alt](./flow.diagram.ts)` becomes the figure.
//   expandMarkdown(text, {file, ...})  →  the Markdown with each figure replaced, plus the SVGs it drew
// An image whose target ends in `.diagram.ts` is a diagram source (the module `svg-diagram build` takes, path relative to the
// Markdown file; it is imported and run, so it must be inside `root`, default the working folder — never use this on a page you do
// not trust). Text a Markdown renderer would not read as an image is left alone: fenced and indented code blocks, code spans on one
// line, HTML comments, `\!`. Reference-style images (`![alt][ref]`) and code spans across lines are not recognised.
//   mode 'file'   (default)  the SVG is returned in `files` and the image points at it — the Markdown stays portable
//   mode 'inline'            the <svg> itself replaces the image (as an HTML block), for renderers that cannot load files
//   render 'html'            the figure as HTML/CSS (what `build --html` writes) replaces the image; it is always inline
// `![alt](flow.diagram.ts#html)` / `#svg` picks the output for that one figure. An inline figure needs a line of its own: inside a
// list item, a quote or a table cell an <svg> falls back to a file image (see `notes`) and the HTML form is a problem.
// Nothing is written here; the CLI (`svg-diagram md`) writes `files` and the Markdown. A figure that fails verification
// is reported in `problems` and its image is left as written.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {renderSource} from './render-source.ts';
import {diagramTarget, decodeTarget, resolveSource, figureName, inlineSvg, htmlFigure, type Render} from './markdown-target.ts';

export interface ExpandOptions {
  /** The Markdown file's path — sources are resolved from its directory. */
  file: string;
  mode?: 'file' | 'inline';
  /** 'svg' (default) or 'html' (HTML/CSS, always inline). A `#svg` / `#html` on an image's target wins. */
  render?: Render;
  /** Where the SVGs will be written, relative to the Markdown file's directory (default: svg). Used for the image targets. */
  svgDir?: string;
  /** Sources must be inside this folder (default: the working folder). */
  root?: string;
  /** Passed to renderSource. */
  fresh?: boolean;
}

export interface Figure {
  /** The source, absolute. */
  source: string;
  /** The SVG's file name inside svgDir (mode 'file'): the source's name and a hash of its path, so pages sharing a folder never overwrite each other. */
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
  /** Figures that were not put where they were asked (an inline figure inside a list or a quote became a file image). */
  notes: string[];
}

const IMAGE = /!\[([^\]\n]*)\]\(\s*<?([^)\s>]+\.diagram\.ts(?:#(?:svg|html))?)>?(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/dg;

/** The same text with every inline code span's and one-line comment's characters blanked, so a match inside one can be told apart by offset. */
function maskCode(line: string): string {
  return line.replace(/(`+)(.+?)\1|<!--.*?-->/g, m => ' '.repeat(m.length));
}

export async function expandMarkdown(text: string, opts: ExpandOptions): Promise<ExpandResult> {
  const dir = path.dirname(path.resolve(opts.file));
  const svgDir = (opts.svgDir ?? 'svg').replace(/\/+$/, '');
  const mode = opts.mode ?? 'file';
  const figures = new Map<string, Figure>();
  const problems: string[] = [];
  const notes: string[] = [];
  const failed = new Set<string>();
  const seen = new Map<string, number>();

  const draw = async (rel: string): Promise<Figure | undefined> => {
    let src: string;
    try { src = resolveSource(decodeTarget(rel), dir, opts.root); } catch (e) { problems.push((e as Error).message); return undefined; }
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
      const name = `${figureName(src)}-${createHash('sha1').update(src).digest('hex').slice(0, 8)}.svg`;
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
  let comment = false;
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const ln = raw.replace(/\r$/, '');
    // a fence opens and closes at any indent and inside quotes / list items; a line of a comment or an indented block is skipped
    const m = /^[ \t>]*(?:(?:[-*+]|\d+[.)])[ \t]+)?(`{3,}|~{3,})/.exec(ln);
    if (fence) { if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !ln.slice(m[0].length).trim()) fence = undefined; continue; }
    if (comment) { if (ln.includes('-->')) comment = false; continue; }
    if (m) { fence = m[1]; continue; }
    if (/^\s*<!--/.test(ln) && !ln.includes('-->', ln.indexOf('<!--') + 4)) { comment = true; continue; }
    if (/^\s*(?:[-*+]|\d+[.)])[ \t]/.test(ln)) inList = true;
    else if (ln.trim() && !/^\s/.test(ln)) inList = false;
    if (/^( {4,}|\t)/.test(ln) && !inList && (i === 0 || !lines[i - 1].trim() || /^( {4,}|\t)/.test(lines[i - 1]))) continue;
    const masked = maskCode(ln);
    const hits = [...masked.matchAll(IMAGE)];
    if (!hits.length) continue;
    let out = '';
    let at = 0;
    for (const h of hits) {
      const real = ln.slice(h.index, h.index + h[0].length);
      out += ln.slice(at, h.index);
      at = h.index + h[0].length;
      if (h.index > 0 && ln[h.index - 1] === '\\') { out += real; continue; }
      const [a0, a1] = h.indices![1]!;
      const alt = ln.slice(a0, a1);
      const t = diagramTarget(h[2]);
      if (!t) { out += real; continue; }
      const title = h[3] ?? h[4];
      const f = await draw(t.file);
      if (!f) { out += real; continue; }
      const render = t.render ?? opts.render ?? 'svg';
      const file = `![${alt}](${svgDir}/${f.name}${title !== undefined ? ` "${title}"` : ''})`;
      // an HTML block must start a line: not inside a list item, a quote or a table row, and nothing else on its line
      const alone = !ln.slice(0, h.index).trim() && !ln.slice(at).trim() && !/^\s*(?:[>|]|(?:[-*+]|\d+[.)])\s)/.test(ln) && !inList;
      if (render === 'html') {
        if (!alone) { problems.push(`${path.relative(dir, f.source)}: the HTML form needs a line of its own (not in a list, a quote or a table, and no text beside it)`); out += real; continue; }
        out += `\n\n${htmlFigure(f.html, alt)}\n\n`;
      } else if (mode === 'inline') {
        if (!alone) { notes.push(`${path.relative(dir, f.source)}: line ${i + 1} is in a list, a quote or a table, or has text beside the figure — kept as an image of ${f.name}`); out += file; continue; }
        out += `\n\n${inlineSvg(f.svg, alt || undefined, seen)}\n\n`;
      } else out += file;
    }
    lines[i] = out + ln.slice(at) + (raw.endsWith('\r') ? '\r' : '');
  }
  return {markdown: lines.join('\n'), figures: [...figures.values()], problems, notes};
}
