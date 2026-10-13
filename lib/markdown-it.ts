// markdown-it plugin: an image whose target is a diagram source — `![alt](./flow.diagram.ts)` — renders as the figure, inline.
//   import MarkdownIt from 'markdown-it'; import svgDiagram from 'svg-diagram/markdown-it';
//   const md = new MarkdownIt().use(svgDiagram);        // VitePress: markdown: {config: svgDiagram()} from 'svg-diagram/vitepress'
// `render: 'svg'` (default) draws an <svg>; `render: 'html'` the HTML/CSS form (`svg-diagram build --html`: selectable text,
// styleable with CSS). `![alt](flow.diagram.ts#html)` / `#svg` picks one for that figure.
// markdown-it renders synchronously and a figure is drawn asynchronously, so each figure is drawn in a child process
// (lib/render-sync-worker) that the renderer waits for. Results are cached per source until it or a file it imports changes.
// Each figure's source and imports are added to env.includes (VitePress's list of files a page depends on). The source's path is relative to the page: env.path / env.filePath (VitePress sets env.path), else `baseDir`, else the cwd.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {diagramTarget, noBlankLines, type Render} from './markdown-target.ts';

export interface SvgDiagramPluginOptions {
  /** 'svg' (default) or 'html'. A `#svg` / `#html` on an image's target wins. */
  render?: Render;
  /** Where relative sources are resolved from when the page's own path is unknown. */
  baseDir?: string;
  /** true (default): a figure that fails verification or does not load throws, so the build stops. false: draw it anyway / show the error in the page. */
  strict?: boolean;
}

interface Drawn {svg: string; html: string; ok: boolean; problems: string[]; deps: string[]}
const cache = new Map<string, {drawn: Drawn; stamps: Map<string, number>}>();
const WORKER = new URL(import.meta.url.endsWith('.ts') ? './render-sync-worker.ts' : './render-sync-worker.js', import.meta.url);

const mtime = (f: string): number => { try { return fs.statSync(f).mtimeMs; } catch { return -1; } };

function draw(src: string): Drawn {
  const hit = cache.get(src);
  if (hit && [...hit.stamps].every(([f, t]) => mtime(f) === t)) return hit.drawn;
  const r = spawnSync(process.execPath, [WORKER.pathname, src], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  let out: Drawn & {error?: string};
  try { out = JSON.parse(r.stdout); } catch { throw new Error(`svg-diagram: could not draw ${src}: ${r.stderr.trim() || `exit ${r.status}`}`); }
  if (out.error) throw new Error(out.error);
  cache.set(src, {drawn: out, stamps: new Map(out.deps.map(f => [f, mtime(f)]))});
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Only what the plugin touches of markdown-it, so it needs no type import from it.
interface Token {type: string; children: Token[] | null; content: string; attrGet(n: string): string | null; map: [number, number] | null; block: boolean; level: number}
interface State {tokens: Token[]; env: any; Token: new (type: string, tag: string, nesting: number) => Token}
interface MdLike {
  renderer: {rules: {image?: (tokens: any[], idx: number, options: any, env: any, self: any) => string}};
  core: {ruler: {after(after: string, name: string, fn: (state: any) => void): void}};
}

export default function svgDiagram(md: MdLike, opts: SvgDiagramPluginOptions = {}): void {
  const strict = opts.strict ?? true;

  /** The figure for an image token, or undefined when the image is not a diagram source. */
  const figure = (tok: Token, env: any): string | undefined => {
    const t = diagramTarget(tok.attrGet('src') ?? '');
    if (!t) return undefined;
    const page: string | undefined = env?.path ?? env?.filePath;
    const base = page ? path.dirname(path.resolve(page)) : path.resolve(opts.baseDir ?? process.cwd());
    const src = path.resolve(base, decodeURI(t.file));
    let r: Drawn;
    try { r = draw(src); } catch (e) {
      if (strict) throw e;
      return `<p class="svg-diagram-error">${esc((e as Error).message)}</p>`;
    }
    // VitePress watches the files listed in env.includes and re-renders the page when one changes.
    if (Array.isArray(env?.includes)) env.includes.push(...r.deps);
    if (!r.ok && strict) throw new Error(`svg-diagram: ${path.relative(base, src)}: ${r.problems.join('; ')}`);
    if ((t.render ?? opts.render ?? 'svg') === 'html') return noBlankLines(r.html);
    const svg = r.svg.replace(/^\s*<\?xml[^>]*\?>\s*/, '').trim();
    const alt = tok.content;
    return alt && !/\brole=/.test(svg.slice(0, svg.indexOf('>'))) ? svg.replace(/^<svg\b/, `<svg role="img" aria-label="${esc(alt)}"`) : svg;
  };

  // A paragraph that is only a diagram becomes a block of its own (HTML/CSS has <div>s, which a <p> cannot hold).
  md.core.ruler.after('inline', 'svg_diagram_block', (state: State) => {
    const {tokens} = state;
    for (let i = 0; i + 2 < tokens.length; i++) {
      const [open, inline, close] = [tokens[i], tokens[i + 1], tokens[i + 2]];
      if (open.type !== 'paragraph_open' || inline.type !== 'inline' || close.type !== 'paragraph_close') continue;
      const kids = (inline.children ?? []).filter(c => !(c.type === 'text' && !c.content.trim()) && c.type !== 'softbreak');
      if (kids.length !== 1 || kids[0].type !== 'image') continue;
      const html = figure(kids[0], state.env);
      if (html === undefined) continue;
      const block = new state.Token('html_block', '', 0);
      block.content = html + '\n';
      block.map = open.map;
      block.block = true;
      tokens.splice(i, 3, block);
    }
  });

  // A diagram inside running text stays inline.
  const prev = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) =>
    figure(tokens[idx], env) ?? (prev ? prev(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options));
}
