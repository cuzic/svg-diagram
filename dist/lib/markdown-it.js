// markdown-it plugin: an image whose target is a diagram source — `![alt](./flow.diagram.ts)` — renders as the figure, inline.
//   import MarkdownIt from 'markdown-it'; import svgDiagram from 'svg-diagram/markdown-it';
//   const md = new MarkdownIt().use(svgDiagram);        // VitePress: markdown: {config: svgDiagram()} from 'svg-diagram/vitepress'
// `render: 'svg'` (default) draws an <svg>; `render: 'html'` the HTML/CSS form (`svg-diagram build --html`: selectable text,
// styleable with CSS; only for a figure alone in its paragraph — inside running text it is drawn as an <svg>). `![alt](flow.diagram.ts#html)` /
// `#svg` picks one for that figure.
// The source is imported and run: it must be inside `root` (default: the working folder), and a page you do not trust must not use this.
// markdown-it renders synchronously and a figure is drawn asynchronously, so each figure is drawn in a child process
// (lib/render-sync-worker) that the renderer waits for (`timeout`, default 120 s). Results are cached until the source, a file it
// imports, or the settings it was drawn with (.svg-diagram.json, svg-diagram.icons.json) change.
// Each of those files is added to env.includes (VitePress's list of files a page depends on). The source's path is relative to the page: env.path / env.filePath (VitePress sets env.path), else `baseDir`, else the cwd.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { diagramTarget, decodeTarget, inlineSvg, htmlFigure, vueHtml, escAttr } from './markdown-target.js';
import { resolveSource } from './source-path.js';
import { must } from './must.js';
const cache = new Map();
const WORKER = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? './render-sync-worker.ts' : './render-sync-worker.js', import.meta.url));
const mtime = (f) => { try {
    return fs.statSync(f).mtimeMs;
}
catch {
    return -1;
} };
function draw(src, html, timeout) {
    const hit = cache.get(src);
    if (hit && (!html || hit.drawn.html !== undefined) && [...hit.stamps].every(([f, t]) => mtime(f) === t))
        return hit.drawn;
    const started = Date.now();
    const r = spawnSync(process.execPath, [WORKER, src, html ? '1' : '0'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout, killSignal: 'SIGKILL', stdio: ['ignore', 'ignore', 'pipe', 'pipe'] });
    const why = () => r.error ? r.error.message : r.signal ? `killed by ${r.signal}${r.error ? '' : ' (timeout?)'}` : `exit ${r.status}`;
    const raw = r.output?.[3];
    let out;
    try {
        out = JSON.parse(raw ?? '');
    }
    catch {
        throw new Error(`svg-diagram: could not draw ${src}: ${why()}${r.stderr ? ` — ${r.stderr.trim().split('\n').slice(-3).join(' | ')}` : ''}`);
    }
    if (out.error)
        throw new Error(out.error);
    // A file saved while the figure was being drawn would be paired with the picture of its older text: not cached then.
    if (out.deps.every(f => mtime(f) <= started))
        cache.set(src, { drawn: out, stamps: new Map(out.deps.map(f => [f, mtime(f)])) });
    else
        cache.delete(src);
    return out;
}
/** An image's alt as plain text (`**x**` → `x`), as markdown-it's own image rule makes it. */
const altOf = (tok) => (tok.children ?? []).map(c => c.type === 'text' || c.type === 'code_inline' ? c.content : c.type === 'softbreak' || c.type === 'hardbreak' ? ' ' : c.type === 'image' ? altOf(c) : '').join('');
export default function svgDiagram(md, opts = {}) {
    const strict = opts.strict ?? true;
    const timeout = opts.timeout ?? 120000;
    /** The figure for an image token, or undefined when the image is not a diagram source. `inline`: it sits in running text. */
    // biome-ignore lint/suspicious/noExplicitAny: the real markdown-it types are not imported, and its callbacks take `any`, so ours must too to accept them
    const figure = (tok, env, inline) => {
        const t = diagramTarget(tok.attrGet('src') ?? '');
        if (!t)
            return undefined;
        const page = env?.path ?? env?.filePath;
        const base = page ? path.dirname(path.resolve(page)) : path.resolve(opts.baseDir ?? process.cwd());
        // the HTML form is made of <div>s, so it needs a paragraph of its own; inside running text the figure is drawn as an <svg>
        const html = (t.render ?? opts.render ?? 'svg') === 'html' && !inline;
        let r, src = t.file;
        try {
            src = resolveSource(decodeTarget(t.file), base, opts.root);
            r = draw(src, html, timeout);
        }
        catch (e) {
            if (strict)
                throw e;
            // the message names files by their path from the page, not the build machine's
            const msg = e.message.split(base + path.sep).join('').split(process.cwd() + path.sep).join('');
            const span = `<span class="svg-diagram-error">${escAttr(msg)}</span>`;
            return opts.vue ? vueHtml(span, inline ? 'span' : 'div') : span;
        }
        // VitePress watches the files listed in env.includes and re-renders the page when one changes.
        if (Array.isArray(env?.includes))
            env.includes.push(...r.deps);
        if (!r.ok && strict)
            throw new Error(`svg-diagram: ${path.relative(base, src)}: ${r.problems.join('; ')}`);
        const alt = altOf(tok) || undefined;
        const seen = (env.__svgDiagramSeen ??= new Map());
        const body = html ? htmlFigure(must(r.html), alt, seen) : inlineSvg(r.svg, alt, seen);
        return opts.vue ? vueHtml(body, inline ? 'span' : 'div') : body;
    };
    // A paragraph that is only a diagram becomes a block of its own (HTML/CSS has <div>s, which a <p> cannot hold).
    md.core.ruler.after('inline', 'svg_diagram_block', (state) => {
        const { tokens } = state;
        for (let i = 0; i + 2 < tokens.length; i++) {
            const [open, inline, close] = [must(tokens[i]), must(tokens[i + 1]), must(tokens[i + 2])];
            if (open.type !== 'paragraph_open' || inline.type !== 'inline' || close.type !== 'paragraph_close')
                continue;
            const kids = (inline.children ?? []).filter(c => !(c.type === 'text' && !c.content.trim()) && c.type !== 'softbreak');
            const kid = kids[0];
            if (kids.length !== 1 || !kid || kid.type !== 'image')
                continue;
            const html = figure(kid, state.env, false);
            if (html === undefined)
                continue;
            const block = new state.Token('html_block', '', 0);
            block.content = html + '\n';
            block.map = open.map;
            block.block = true;
            tokens.splice(i, 3, block);
        }
    });
    // A diagram inside running text stays inline.
    const prev = md.renderer.rules.image;
    md.renderer.rules.image = (tokens, idx, options, env, self) => figure(tokens[idx], env, true) ?? (prev ? prev(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options));
}
