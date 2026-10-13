// remark plugin: an image whose target is a diagram source — `![alt](./flow.diagram.ts)` — becomes the figure, inline.
//   unified().use(remarkParse).use(svgDiagram).use(remarkRehype).use(rehypeStringify)
// `render: 'svg'` (default) gives an <svg>; `render: 'html'` the HTML/CSS form (`svg-diagram build --html`); `#svg` / `#html` on a target
// picks one for that figure. Either way the figure becomes a node that remark-rehype turns into real <svg> elements (data.hName / hChildren), not a raw `html` node,
// so no allowDangerousHtml and no rehype-raw are needed, and rehype plugins (sanitize, …) see the elements. The source's path is relative to the page (file.path), else `baseDir`, else the cwd.
// Code blocks and inline code are not images, so they are left alone. A transformer may be async, so the figure is drawn
// in-process (no child process, unlike the markdown-it plugin).
import path from 'node:path';
import {renderSource} from './render-source.ts';
import {parseXml, parseXmlFragment, type El} from './svg-dom.ts';
import {diagramTarget, type Render} from './markdown-target.ts';

export interface RemarkSvgDiagramOptions {
  /** 'svg' (default) or 'html'. A `#svg` / `#html` on an image's target wins. */
  render?: Render;
  /** Where relative sources are resolved from when the file has no path. */
  baseDir?: string;
  /** true (default): a figure that fails verification or does not load fails the file. false: draw it anyway and add a message. */
  strict?: boolean;
}

// Only the parts of mdast / vfile the plugin touches.
interface Node {type: string; url?: string; alt?: string; title?: string | null; children?: Node[]; data?: Record<string, unknown>}
interface Hast {type: 'element' | 'text'; tagName?: string; properties?: Record<string, string>; children?: Hast[]; value?: string}

const toHast = (c: El | string): Hast => typeof c === 'string'
  ? {type: 'text', value: c}
  : {type: 'element', tagName: c.tag, properties: c.attrs, children: c.children.map(toHast)};
interface File {path?: string; fail(reason: string, node?: Node): never; message(reason: string, node?: Node): unknown}

export default function remarkSvgDiagram(opts: RemarkSvgDiagramOptions = {}) {
  const strict = opts.strict ?? true;
  return async (tree: Node, file: File): Promise<void> => {
    const base = file.path ? path.dirname(path.resolve(file.path)) : path.resolve(opts.baseDir ?? process.cwd());
    const found: Node[] = [];
    const walk = (n: Node) => {
      if (n.type === 'image' && n.url && diagramTarget(n.url)) found.push(n);
      n.children?.forEach(walk);
    };
    walk(tree);
    for (const n of found) {
      const target = diagramTarget(n.url!)!;
      const src = path.resolve(base, decodeURI(target.file));
      const label = path.relative(base, src);
      let r;
      try { r = await renderSource(src, {html: (target.render ?? opts.render) === 'html'}); } catch (e) {
        if (strict) file.fail(`${label}: ${(e as Error).message}`, n);
        file.message(`${label}: ${(e as Error).message}`, n);
        continue;
      }
      if (!r.ok) {
        const msg = `${label}: ${r.problems.join('; ')}`;
        if (strict) file.fail(msg, n);
        file.message(msg, n);
      }
      const alt = n.alt ?? '';
      n.type = 'svgDiagram';
      if (r.html !== undefined) {
        // The HTML form is a <style> and a <div> (well-formed, so the XML reader takes it): a wrapper element holds both.
        n.data = {hName: 'div', hProperties: {className: ['svg-diagram']}, hChildren: parseXmlFragment(r.html).children.map(toHast)};
      } else {
        const root = parseXml(r.svg);
        // A node type remark-rehype has no handler for becomes an element from data.hName/hProperties/hChildren.
        n.data = {
          hName: 'svg',
          hProperties: {...root.attrs, ...(alt && !root.attrs.role ? {role: 'img', ariaLabel: alt} : {})},
          hChildren: root.children.map(toHast),
        };
      }
      delete n.url;
      delete n.alt;
      delete n.title;
    }
  };
}
