// What the Markdown integrations (`svg-diagram md`, markdown-it, remark, VitePress) share: which image targets are diagram sources,
// where a source may live, and how a figure is put into a page.
//   `flow.diagram.ts`, optionally `flow.diagram.ts#html` / `#svg` to pick the output for that one figure.
import { createHash } from 'node:crypto';
import { must } from './must.js';
import { scopeRules } from './scope-style.js';
const TARGET = /^(.+\.diagram\.ts)(?:#(svg|html))?$/;
/** The source path and the per-figure output choice, or undefined when the target is not a diagram source (a URL, any other file). */
export function diagramTarget(target) {
    if (/^[a-z][a-z0-9+.-]+:/i.test(target))
        return undefined; // a URL; `C:/x` (one letter) is a drive, and resolveSource refuses it
    const m = TARGET.exec(target);
    return m ? { file: must(m[1]), ...(m[2] ? { render: m[2] } : {}) } : undefined;
}
/** A markdown target is percent-encoded; a lone `%` (`100%.diagram.ts`) is read as it is. */
export function decodeTarget(file) {
    try {
        return decodeURI(file);
    }
    catch {
        return file;
    }
}
/** `dir/flow.diagram.ts` → `flow` */
export const figureName = (file) => file.replace(/^.*[\\/]/, '').replace(/\.diagram\.ts$/, '');
/** Markdown HTML blocks end at a blank line, so the fragment must not contain one. */
export const noBlankLines = (s) => s.replace(/\n\s*\n/g, '\n');
export const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/**
 * The figure's <svg>, ready to sit in a page: its ids (and every reference to them) get a prefix of their own, so two figures —
 * or the same one twice (`seen` counts them) — never share an id; its <style> applies to it alone; an `alt` becomes its name
 * (instead of the <title> it was labelled by); it shrinks to the page's width.
 */
export function inlineSvg(svg, alt, seen) {
    let s = svg.replace(/^\s*<\?xml[^>]*\?>\s*/, '').trim();
    const hash = createHash('sha1').update(s).digest('hex').slice(0, 8);
    const n = (seen.get(hash) ?? 0) + 1;
    seen.set(hash, n);
    const pre = `sd${hash}${n > 1 ? `-${n}` : ''}`;
    const ids = new Set([...s.matchAll(/\sid="([^"]+)"/g)].map(m => must(m[1])));
    const re = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const id of ids) {
        s = s.replace(new RegExp(`(\\sid=")${re(id)}(")`, 'g'), `$1${pre}-${id}$2`)
            .replace(new RegExp(`url\\(#${re(id)}\\)`, 'g'), `url(#${pre}-${id})`)
            .replace(new RegExp(`((?:xlink:)?href=")#${re(id)}(")`, 'g'), `$1#${pre}-${id}$2`);
    }
    s = s.replace(/(\saria-(?:labelledby|describedby)=")([^"]*)(")/g, (_, a, v, c) => a + v.split(/\s+/).map(t => ids.has(t) ? `${pre}-${t}` : t).join(' ') + c);
    s = s.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${scopeRules(css, pre)}</style>`);
    const end = s.indexOf('>');
    let root = s.slice(0, end);
    if (alt)
        root = root.replace(/\saria-labelledby="[^"]*"/, '').replace(/\saria-label="[^"]*"/, '');
    if (!/\sid="/.test(root))
        root += ` id="${pre}"`;
    if (alt)
        root += ` aria-label="${escAttr(alt)}"`;
    if (alt && !/\srole="/.test(root))
        root += ' role="img"';
    root = /\sstyle="/.test(root) ? root.replace(/\sstyle="/, ' style="max-width:100%;height:auto;') : `${root} style="max-width:100%;height:auto"`;
    return noBlankLines(root + s.slice(end));
}
/**
 * The HTML/CSS form of a figure, in a wrapper that carries the alt text. It is made of <div>s, and an HTML parser closes an open <p>
 * at a <div> — whatever sits between — so it can only stand as a block of its own, never inside running text (that is drawn as an <svg>).
 */
export function htmlFigure(html, alt, seen) {
    // the figure's id is a hash of its content: the same figure twice gets a suffix on its second, so no id repeats on a page
    const id = /\sid="(sd-[0-9a-f]+)"/.exec(html)?.[1];
    let h = noBlankLines(html).trim();
    if (id) {
        const n = (seen.get(id) ?? 0) + 1;
        seen.set(id, n);
        if (n > 1)
            h = h.split(id).join(`${id}-${n}`);
    }
    return `<div class="svg-diagram"${alt ? ` role="figure" aria-label="${escAttr(alt)}"` : ''}>${h}</div>`;
}
/** Markdown inline text as plain text, for an `aria-label`: `**x**` → `x`, `[x](y)` → `x`, `` `x` `` → `x`, `\*` → `*`. */
export function plainText(md) {
    return md.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/(\*\*|__|\*|_|~~|`)/g, '').replace(/\\([\\`*_{}[\]()#+\-.!~])/g, '$1');
}
/**
 * A Vue template reads `{{ }}` in text, drops <style>, and compiles twice (server, client), so a figure goes in as the value of
 * v-html: the same string on both sides, never parsed as a template.
 */
export function vueHtml(content, tag = 'div') {
    return `<${tag} class="svg-diagram-vue" v-html="${escAttr(JSON.stringify(content))}"></${tag}>`;
}
