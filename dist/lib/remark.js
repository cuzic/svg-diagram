// remark plugin: an image whose target is a diagram source — `![alt](./flow.diagram.ts)` — becomes the figure, inline.
//   unified().use(remarkParse).use(svgDiagram).use(remarkRehype).use(rehypeStringify)
// `render: 'svg'` (default) gives an <svg>; `render: 'html'` the HTML/CSS form (`svg-diagram build --html`); `#svg` / `#html` on a target
// picks one for that figure (the HTML form only for a figure alone in its paragraph: inside running text it is drawn as an <svg>). Either way the figure becomes a node that remark-rehype turns into real elements (data.hName / hChildren),
// not a raw `html` node, so no allowDangerousHtml and no rehype-raw are needed, and rehype plugins see the elements (rehype-sanitize
// needs a schema that allows svg / style). A figure alone in its paragraph replaces the paragraph. The source's path is relative to
// the page (file.path), else `baseDir`, else the cwd; it is imported and run, so it must be inside `root` (default: the working
// folder), and a page you do not trust must not use this. A transformer may be async, so the figure is drawn in-process (no child
// process, unlike the markdown-it plugin); drawn figures are kept until the source, a file it imports, or the settings change, and the
// files are listed in file.data.svgDiagramDeps for a watcher.
import fs from 'node:fs';
import path from 'node:path';
import { renderSource } from './render-source.js';
import { parseXml, parseXmlFragment } from './svg-dom.js';
import { diagramTarget, decodeTarget, inlineSvg } from './markdown-target.js';
import { resolveSource } from './source-path.js';
import { must } from './must.js';
const camel = (k) => k.includes('-') ? k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : k;
/** An XML attribute as a hast property: `class` → className (a list), `stroke-width` → strokeWidth, `aria-label` → ariaLabel. */
const props = (attrs) => Object.fromEntries(Object.entries(attrs).map(([k, v]) => k === 'class' ? ['className', v.split(/\s+/).filter(Boolean)] : [camel(k), v]));
const toHast = (c) => typeof c === 'string'
    ? { type: 'text', value: c }
    : { type: 'element', tagName: c.tag, properties: props(c.attrs), children: c.children.map(toHast) };
const cache = new Map();
const mtime = (f) => { try {
    return fs.statSync(f).mtimeMs;
}
catch {
    return -1;
} };
async function draw(src, html) {
    const hit = cache.get(src);
    if (hit && (!html || hit.drawn.html !== undefined) && [...hit.stamps].every(([f, t]) => mtime(f) === t))
        return hit.drawn;
    const started = Date.now();
    const r = await renderSource(src, { html, fresh: true });
    // A file saved while the figure was being drawn would be paired with the picture of its older text: not kept then.
    if (r.deps.every(f => mtime(f) <= started))
        cache.set(src, { drawn: r, stamps: new Map(r.deps.map(f => [f, mtime(f)])) });
    else
        cache.delete(src);
    return r;
}
export default function remarkSvgDiagram(opts = {}) {
    const strict = opts.strict ?? true;
    return async (tree, file) => {
        const base = file.path ? path.dirname(path.resolve(file.path)) : path.resolve(opts.baseDir ?? process.cwd());
        const found = [];
        const walk = (n, parent) => {
            if (parent && n.type === 'image' && n.url && diagramTarget(n.url))
                found.push({ node: n, parent });
            n.children?.forEach(c => walk(c, n));
        };
        walk(tree);
        const seen = new Map();
        const deps = new Set();
        for (const { node: n, parent } of found) {
            const target = must(diagramTarget(must(n.url)));
            // the HTML form is made of <div>s, so it needs a paragraph of its own; inside running text the figure is drawn as an <svg>
            const lone = parent.type === 'paragraph' && must(parent.children).length === 1;
            const html = (target.render ?? opts.render) === 'html' && lone;
            let src = target.file, r;
            const bad = (msg) => { if (strict)
                file.fail(msg, n); file.message(msg, n); };
            try {
                src = resolveSource(decodeTarget(target.file), base, opts.root);
                r = await draw(src, html);
            }
            catch (e) {
                bad(`${path.relative(base, src)}: ${e.message.split(base + path.sep).join('').split(process.cwd() + path.sep).join('')}`);
                continue;
            }
            r.deps.forEach(d => deps.add(d));
            if (!r.ok)
                bad(`${path.relative(base, src)}: ${r.problems.join('; ')}`);
            const alt = n.alt ?? '';
            // A node type remark-rehype has no handler for becomes an element from data.hName/hProperties/hChildren.
            const fig = { type: 'svgDiagram', data: html
                    ? { hName: 'div', hProperties: { className: ['svg-diagram'], ...(alt ? { role: 'figure', ariaLabel: alt } : {}) }, hChildren: parseXmlFragment(dedupeId(must(r.html), seen)).children.map(toHast) }
                    : (() => { const root = parseXml(inlineSvg(r.svg, alt || undefined, seen)); return { hName: 'svg', hProperties: props(root.attrs), hChildren: root.children.map(toHast) }; })() };
            // A paragraph that is only the figure is replaced (<p> cannot hold the <div>s of the HTML form).
            const holder = lone ? findParent(tree, parent) : undefined;
            if (lone && holder)
                must(holder.children)[must(holder.children).indexOf(parent)] = fig;
            else {
                Object.assign(n, fig);
                delete n.url;
                delete n.alt;
                delete n.title;
            }
        }
        file.data['svgDiagramDeps'] = [...deps];
    };
}
/** The same HTML figure twice on a page: its content-hash id gets a suffix the second time. */
function dedupeId(html, seen) {
    const id = /\sid="(sd-[0-9a-f]+)"/.exec(html)?.[1];
    if (!id)
        return html;
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n > 1 ? html.split(id).join(`${id}-${n}`) : html;
}
function findParent(root, target) {
    for (const c of root.children ?? []) {
        if (c === target)
            return root;
        const f = findParent(c, target);
        if (f)
            return f;
    }
    return undefined;
}
