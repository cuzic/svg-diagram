// remark plugin: an image whose target is a diagram source — `![alt](./flow.ts)` — becomes the figure's inline <svg>.
//   unified().use(remarkParse).use(svgDiagram).use(remarkRehype, {allowDangerousHtml: true}).use(rehypeStringify, {allowDangerousHtml: true})
// The svg is an `html` node, so remark-rehype needs allowDangerousHtml (and rehype-raw, or the stringifier's
// allowDangerousHtml, to pass it through). The source's path is relative to the page (file.path), else `baseDir`, else the cwd.
// Code blocks and inline code are not images, so they are left alone. A transformer may be async, so the figure is drawn
// in-process (no child process, unlike the markdown-it plugin).
import path from 'node:path';
import {renderSource} from './render-source.ts';
import {inlineSvg} from './markdown.ts';

export interface RemarkSvgDiagramOptions {
  /** Where relative sources are resolved from when the file has no path. */
  baseDir?: string;
  /** true (default): a figure that fails verification or does not load fails the file. false: draw it anyway and add a message. */
  strict?: boolean;
}

// Only the parts of mdast / vfile the plugin touches.
interface Node {type: string; url?: string; alt?: string; value?: string; children?: Node[]}
interface File {path?: string; fail(reason: string, node?: Node): never; message(reason: string, node?: Node): unknown}

export default function remarkSvgDiagram(opts: RemarkSvgDiagramOptions = {}) {
  const strict = opts.strict ?? true;
  return async (tree: Node, file: File): Promise<void> => {
    const base = file.path ? path.dirname(path.resolve(file.path)) : path.resolve(opts.baseDir ?? process.cwd());
    const found: Node[] = [];
    const walk = (n: Node) => {
      if (n.type === 'image' && n.url && /\.ts$/.test(n.url) && !/^[a-z][a-z0-9+.-]*:/i.test(n.url)) found.push(n);
      n.children?.forEach(walk);
    };
    walk(tree);
    for (const n of found) {
      const src = path.resolve(base, decodeURI(n.url!));
      const label = path.relative(base, src);
      let r;
      try { r = await renderSource(src); } catch (e) {
        if (strict) file.fail(`${label}: ${(e as Error).message}`, n);
        file.message(`${label}: ${(e as Error).message}`, n);
        continue;
      }
      if (!r.ok) {
        const msg = `${label}: ${r.problems.join('; ')}`;
        if (strict) file.fail(msg, n);
        file.message(msg, n);
      }
      n.type = 'html';
      n.value = inlineSvg(r.svg, n.alt ?? '').trim();
      delete n.url;
      delete n.alt;
    }
  };
}
