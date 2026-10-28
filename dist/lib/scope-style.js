// Confining a <style>'s rules to one figure: every selector gets `#<pre> ` in front, so `text { … }` only reaches the text inside `#<pre>`.
// Shared by markdown-target.inlineSvg (one figure in a page) and deck-html (many figures in one document).
const RULE = /(^|\})\s*([^{}@]+)\{/g;
/** One selector, scoped. A selector that starts at the root element (`svg[data-appearance="auto"] …`, ADR 0023) also matches when the
 *  id sits on that root itself (inlineSvg puts it there), so it is written both ways: `#pre svg… , svg#pre…`. */
function scoped(sel, pre) {
    const s = sel.trim();
    const m = /^svg(?=[\s[.:#]|$)/.exec(s);
    return m ? `#${pre} ${s}, svg#${pre}${s.slice(3)}` : `#${pre} ${s}`;
}
/** The rules of `css` outside any @-block, scoped. */
function scopeFlat(css, pre) {
    return css.replace(RULE, (_m, a, sel) => `${a}\n${sel.split(',').map(x => scoped(x, pre)).join(', ')} {`);
}
/** `css` with `#<pre> ` put before every selector of every rule (a selector list gets it on each member), also inside `@media { … }`. */
export function scopeRules(css, pre) {
    if (!css.includes('@media'))
        return scopeFlat(css, pre); // the usual case: the same text as before @media was understood
    let out = '', rest = css;
    for (;;) {
        const m = /@media[^{}]*\{/.exec(rest);
        if (!m)
            return out + scopeFlat(rest, pre);
        let depth = 1, i = m.index + m[0].length;
        for (; i < rest.length && depth > 0; i++)
            depth += rest[i] === '{' ? 1 : rest[i] === '}' ? -1 : 0;
        const inner = rest.slice(m.index + m[0].length, i - 1);
        out += `${scopeFlat(rest.slice(0, m.index), pre)}${m[0]}${scopeFlat(inner, pre)}}`;
        rest = rest.slice(i);
    }
}
