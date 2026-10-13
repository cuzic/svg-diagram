// markdown-it plugin: an image whose target is a diagram source — `![alt](./flow.ts)` — renders as the figure's inline <svg>.
//   import MarkdownIt from 'markdown-it'; import svgDiagram from 'svg-diagram/markdown-it';
//   const md = new MarkdownIt().use(svgDiagram);        // VitePress: markdown: {config: md => md.use(svgDiagram)}
// markdown-it renders synchronously and a figure is drawn asynchronously, so each figure is drawn in a child process
// (lib/render-sync-worker) that the renderer waits for. Results are cached per source until it or a file it imports changes.
// Each figure's source and imports are added to env.includes (VitePress's list of files a page depends on). The source's path is relative to the page: env.path / env.filePath (VitePress sets env.path), else `baseDir`, else the cwd.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export interface SvgDiagramPluginOptions {
  /** Where relative sources are resolved from when the page's own path is unknown. */
  baseDir?: string;
  /** true (default): a figure that fails verification or does not load throws, so the build stops. false: draw it anyway / show the error in the page. */
  strict?: boolean;
}

interface Drawn {svg: string; ok: boolean; problems: string[]; deps: string[]}
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
interface MdLike {
  renderer: {rules: {image?: (tokens: any[], idx: number, options: any, env: any, self: any) => string}};
}

export default function svgDiagram(md: MdLike, opts: SvgDiagramPluginOptions = {}): void {
  const strict = opts.strict ?? true;
  const prev = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const tok = tokens[idx];
    const target: string = tok.attrGet('src') ?? '';
    if (!/\.ts$/.test(target) || /^[a-z][a-z0-9+.-]*:/i.test(target)) {
      return prev ? prev(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
    }
    const page: string | undefined = env?.path ?? env?.filePath;
    const base = page ? path.dirname(path.resolve(page)) : path.resolve(opts.baseDir ?? process.cwd());
    const src = path.resolve(base, decodeURI(target));
    const alt: string = tok.content;
    let r: Drawn;
    try { r = draw(src); } catch (e) {
      if (strict) throw e;
      return `<p class="svg-diagram-error">${esc((e as Error).message)}</p>`;
    }
    // VitePress watches the files listed in env.includes and re-renders the page when one changes.
    if (Array.isArray(env?.includes)) env.includes.push(...r.deps);
    if (!r.ok && strict) throw new Error(`svg-diagram: ${path.relative(base, src)}: ${r.problems.join('; ')}`);
    const svg = r.svg.replace(/^\s*<\?xml[^>]*\?>\s*/, '').trim();
    const labelled = alt && !/\brole=/.test(svg.slice(0, svg.indexOf('>'))) ? svg.replace(/^<svg\b/, `<svg role="img" aria-label="${esc(alt)}"`) : svg;
    return labelled;
  };
}
