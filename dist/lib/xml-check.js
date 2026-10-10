// A dependency-free well-formedness check for the SVG this tool emits.
//
// The page that loads an SVG as <img src="x.svg"> parses it as XML, where a valueless attribute
// (`<g data-badge>`), an unescaped `&` or an unclosed tag makes the whole image fail. lint-svg.ts
// reads the SVG inline in an HTML page, whose parser forgives all of that — so this is the check
// that sees what <img> will see. It is not a full XML parser: it covers what a regression in the
// emitters can plausibly produce (attributes, entities, nesting, comments, CDATA).
const NAME = '[A-Za-z_:][-A-Za-z0-9_:.]*';
const ATTRS = new RegExp(`\\s+${NAME}\\s*=\\s*(?:"[^"<]*"|'[^'<]*')`, 'y');
const BAD_AMP = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);)/;
/** Problems that would stop `svg` from loading as XML; an empty list means well-formed. */
export function xmlProblems(svg) {
    const problems = [];
    const line = (i) => svg.slice(0, i).split('\n').length;
    const stack = [];
    const ctl = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.exec(svg);
    if (ctl)
        problems.push(`line ${line(ctl.index)}: a control character U+${ctl[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')} (XML 1.0 forbids it; a pasted label may carry one)`);
    let i = 0;
    const textCheck = (from, to) => {
        const m = BAD_AMP.exec(svg.slice(from, to));
        if (m)
            problems.push(`line ${line(from + m.index)}: a bare "&" (write &amp;)`);
    };
    while (i < svg.length && problems.length < 10) {
        const lt = svg.indexOf('<', i);
        if (lt === -1) {
            textCheck(i, svg.length);
            break;
        }
        textCheck(i, lt);
        if (svg.startsWith('<!--', lt)) {
            const e = svg.indexOf('-->', lt + 4);
            if (e === -1) {
                problems.push(`line ${line(lt)}: an unterminated comment`);
                break;
            }
            i = e + 3;
            continue;
        }
        if (svg.startsWith('<![CDATA[', lt)) {
            const e = svg.indexOf(']]>', lt);
            if (e === -1) {
                problems.push(`line ${line(lt)}: an unterminated CDATA section`);
                break;
            }
            i = e + 3;
            continue;
        }
        if (svg.startsWith('<?', lt) || svg.startsWith('<!', lt)) {
            const e = svg.indexOf('>', lt);
            if (e === -1) {
                problems.push(`line ${line(lt)}: an unterminated declaration`);
                break;
            }
            i = e + 1;
            continue;
        }
        if (svg[lt + 1] === '/') {
            const m = new RegExp(`</(${NAME})\\s*>`, 'y');
            m.lastIndex = lt;
            const c = m.exec(svg);
            if (!c) {
                problems.push(`line ${line(lt)}: a malformed closing tag`);
                break;
            }
            const open = stack.pop();
            if (open !== c[1])
                problems.push(`line ${line(lt)}: </${c[1]}> closes ${open ? `<${open}>` : 'nothing'}`);
            i = lt + c[0].length;
            continue;
        }
        const nm = new RegExp(NAME, 'y');
        nm.lastIndex = lt + 1;
        const name = nm.exec(svg);
        if (!name) {
            problems.push(`line ${line(lt)}: a "<" that starts no tag (write &lt;)`);
            i = lt + 1;
            continue;
        }
        let p = lt + 1 + name[0].length;
        const seen = new Set();
        for (;;) {
            ATTRS.lastIndex = p;
            const a = ATTRS.exec(svg);
            if (!a)
                break;
            const an = /\s+([^\s=]+)/.exec(a[0])[1];
            if (seen.has(an))
                problems.push(`line ${line(p)}: <${name[0]}> repeats the attribute "${an}"`);
            seen.add(an);
            const val = a[0].slice(a[0].indexOf('=') + 1);
            const bm = BAD_AMP.exec(val);
            if (bm)
                problems.push(`line ${line(p)}: a bare "&" in the attribute "${an}"`);
            p += a[0].length;
        }
        const tail = /\s*(\/?)>/y;
        tail.lastIndex = p;
        const t = tail.exec(svg);
        if (!t) {
            const rest = svg.slice(p, svg.indexOf('>', p) + 1 || p + 40);
            problems.push(`line ${line(p)}: <${name[0]}> has an attribute without a quoted value near "${rest.trim().slice(0, 40)}" (XML needs name="value")`);
            const e = svg.indexOf('>', p);
            if (e === -1)
                break;
            if (svg[e - 1] !== '/')
                stack.push(name[0]);
            i = e + 1;
            continue;
        }
        if (!t[1])
            stack.push(name[0]);
        i = p + t[0].length;
    }
    if (!problems.length && stack.length)
        problems.push(`<${stack[stack.length - 1]}> is never closed`);
    return problems;
}
