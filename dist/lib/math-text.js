// math-text.ts: the wording inside a formula (\text{売上}). MathJax draws a character its own font lacks (CJK) as one <text> per character,
// 884px serif, 1em apart. Here they become one <text> per run, at the em size, with the run's length pinned (textLength), so the formula
// keeps the width MathJax laid out whatever font the viewer picks, and a checker that reads <text> finds the word, not its letters.
// Pure: it only rewrites a string.
// <text data-variant="normal" [transform="translate(X,0) scale(1,-1)" | transform="scale(1,-1)"] font-size="884px" font-family="serif">c</text>
const CHAR = /<text data-variant="normal" transform="(?:translate\((-?[\d.]+(?:e-?\d+)?),0\) )?scale\(1,-1\)" font-size="884px" font-family="serif">([^<]*)<\/text>/g;
const EM = 1000; // MathJax's units per em, and the advance it gives a CJK character
const NARROW = 600; // and the advance it gives any other character its own font lacks (ā, ж, ｱ, ①, €: measured)
const WIDE = /[\u1100-\u11FF\u2E80-\u9FFF\uA960-\uA97F\uAC00-\uD7FF\uF900-\uFAFF\uFE30-\uFE4F\uFF01-\uFF60\uFFE0-\uFFE6\u{20000}-\u{3FFFF}]/u;
const EMOJI = /\p{Extended_Pictographic}/u; // a viewer draws these at its own width: not pinned (math-tex refuses what is left unpinned)
const chars = (s) => [...s.replace(/&(?:#\d+|#x[\da-f]+|\w+);/gi, '.')];
/** The advance MathJax laid out for the run: 1em a CJK character, 0.6em another. */
const length = (s) => chars(s).reduce((n, c) => n + (WIDE.test(c) ? EM : NARROW), 0);
/** Merges the neighbouring one-character <text> elements MathJax writes into one <text> per run. Anything it does not recognise is left as it is. */
export function mergeTextRuns(html) {
    const runs = [];
    for (const m of html.matchAll(CHAR)) {
        const x = m[1] === undefined ? 0 : Number(m[1]), text = m[2] ?? '', at = m.index, last = runs[runs.length - 1];
        if (EMOJI.test(text))
            continue;
        // the same run: directly after the previous element, one em per character further on
        if (last && html.slice(last.to, at) === '' && Math.abs(x - (last.x + length(last.text))) < 0.01) {
            last.to = at + m[0].length;
            last.text += text;
        }
        else
            runs.push({ from: at, to: at + m[0].length, x, text });
    }
    let out = '', pos = 0;
    for (const r of runs) {
        out += html.slice(pos, r.from) + `<text y="0" transform="translate(${r.x},0) scale(1,-1)" font-size="${EM}px" textLength="${length(r.text)}" lengthAdjust="spacing">${r.text}</text>`;
        pos = r.to;
    }
    return out + html.slice(pos);
}
