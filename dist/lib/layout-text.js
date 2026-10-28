// How a band's text is cut up: the text runs of caption / banner / box, the atoms (and spans) a run is measured and wrapped in,
// and the wrapped content of a box-like band. One place, so what is registered for measuring is what layout looks up.
import { splitAtoms, textWidth } from './atoms.js';
import { wrapStyledAtoms } from './wrap.js';
import { assertSpans } from './rich.js';
import { isSolidTone, statFitMin } from './tokens.js';
import { BOX_INNER_GAP, ICON_INDENT, LINE_HEIGHT_EM, STEP_INDENT, topIcon } from './layout-util.js';
import { must } from './must.js';
/** `run` with the pieces of its text attached, when it has any (a plain run stays exactly as it was). */
export function withSpans(run, spans) {
    if (!spans)
        return run;
    assertSpans(run.text, spans, `text "${run.text.slice(0, 20)}"`); // add() takes a band as it is: hand-made spans may not match
    if (run.nowrap)
        throw new Error(`"${run.text.slice(0, 20)}" cannot have spans: a stat value is one unbroken string`);
    return { ...run, spans };
}
const captionRuns = (band, roles) => [withSpans({ text: band.text, size: roles[band.role ?? 'label'], weight: band.bold ? 700 : 400, mono: !!band.mono, tone: band.tone }, band.spans?.text)];
const bannerRuns = (band, roles) => {
    const runs = [withSpans({ text: band.headline, size: roles[band.headlineRole ?? 'banner'], weight: 700, mono: false, tone: band.headlineTone }, band.spans?.headline)];
    if (band.sub)
        runs.push(withSpans({ text: band.sub, size: roles.note, weight: 400, mono: false, tone: band.subTone ?? (isSolidTone(band.tone) ? undefined : 'muted') }, band.spans?.sub));
    return runs;
};
const boxRuns = (band, roles) => {
    const runs = [];
    const iconIndent = band.icon && !topIcon(band) ? { indent: ICON_INDENT } : {}; // (spread, so a box without an icon gets no new field)
    if (band.title)
        runs.push(withSpans({ text: band.title, size: roles.title, weight: 700, mono: !!band.titleMono, tone: band.titleTone, indent: (band.step != null ? STEP_INDENT : 0) + (band.icon && !topIcon(band) ? ICON_INDENT : 0) }, band.spans?.title));
    if (band.body)
        runs.push(withSpans({ text: band.body, size: roles.body, weight: 400, mono: !!band.bodyMono, tone: band.bodyTone, ...iconIndent }, band.spans?.body));
    if (band.lines)
        for (const l of band.lines) {
            const line = typeof l === 'string' ? { text: l } : l;
            const size = roles[line.role ?? 'body'], nowrap = band.statValue === line.text && runs.length === 0;
            runs.push(withSpans({ text: line.text, size, weight: line.bold ? 700 : 400, mono: !!line.mono, tone: line.tone, nowrap, ...(nowrap ? { fit: { min: statFitMin(roles, size) } } : {}), ...iconIndent }, line.spans));
        }
    if (band.note)
        runs.push(withSpans({ text: band.note, size: roles.note, weight: 400, mono: false, tone: band.noteTone ?? (isSolidTone(band.tone) ? undefined : 'muted'), ...iconIndent }, band.spans?.note));
    return runs;
};
export const TEXT_RUNS = { caption: captionRuns, banner: bannerRuns, box: boxRuns };
/** The text runs of a band's own text (none for a type that is not in TEXT_RUNS). */
export function textRuns(band, roles) {
    return TEXT_RUNS[band.type]?.(band, roles) ?? [];
}
/**
 * The atoms of a run, each with its own weight: the ONE place a run is cut up for measuring, wrapping and the width of a line,
 * so what is registered is what is looked up. The plain text is cut as ever (splitAtoms); an atom that a span boundary falls
 * inside ('API' | 's') is cut there into pieces, each continuing the one before it, so it is measured per piece but never
 * broken between lines.
 */
export function styledAtoms(run) {
    const atoms = splitAtoms(run.text);
    if (!run.spans)
        return atoms.map(text => ({ text, weight: run.weight }));
    const spanAt = [];
    run.spans.forEach((sp, i) => { for (let k = 0; k < sp.text.length; k++)
        spanAt.push(i); });
    const out = [];
    let at = 0;
    for (const atom of atoms) {
        for (let from = 0, to = 1; from < atom.length; from = to, to = from + 1) {
            const i = must(spanAt[at + from]);
            while (to < atom.length && spanAt[at + to] === i)
                to++;
            const sp = must(run.spans[i]);
            out.push({ text: atom.slice(from, to), weight: sp.bold ? 700 : run.weight, tone: sp.tone, ...(from > 0 ? { glue: true } : {}) });
        }
        at += atom.length;
    }
    return out;
}
/** The pieces of one wrapped line (neighbouring atoms of one weight and tone make one span). */
function lineSpans(run, atoms) {
    const out = [];
    for (const a of atoms) {
        const bold = a.weight !== run.weight, last = out[out.length - 1];
        if (last && !!last.bold === bold && last.tone === a.tone)
            last.text += a.text;
        else
            out.push({ text: a.text, ...(bold ? { bold: true } : {}), ...(a.tone ? { tone: a.tone } : {}) });
    }
    return out;
}
/** Width of line `i` of a wrapped run: its atoms' widths added (the pieces of a line with spans, each in its own weight). */
export function lineWidth(widthOf, run, i) {
    const font = run.mono ? 'mono' : 'sans';
    return run.lineSpans
        ? must(run.lineSpans[i]).reduce((w, sp) => w + textWidth(widthOf, sp.text, run.size, sp.bold ? 700 : run.weight, font), 0)
        : textWidth(widthOf, must(run.lines[i]), run.size, run.weight, font);
}
/** The largest whole-pixel size from `run.size` down to `run.fit.min` at which the unbroken `run` fits `avail` (the same 0.5px slack as the overflow check); `fit.min` when none does. */
function fittedSize(run, avail, widthOf) {
    const font = run.mono ? 'mono' : 'sans', min = run.fit?.min ?? run.size;
    for (let size = run.size; size > min; size--)
        if (textWidth(widthOf, run.text, size, run.weight, font) <= avail + 0.5)
            return size;
    return Math.min(run.size, min);
}
// Wraps a box-like band's text runs at `wrapWidth` (content width, i.e.
// already excluding BOX_PAD_X*2) and returns {wrappedRuns, textHeight}.
export function layoutBoxContent(band, wrapWidth, widthOf, roles, mode) {
    let relY = 0;
    const wrappedRuns = textRuns(band, roles).map((run) => {
        const font = run.mono ? 'mono' : 'sans';
        const indent = run.indent ?? 0;
        const size = run.fit && run.nowrap ? fittedSize(run, wrapWidth - indent, widthOf) : run.size; // the one size a stat value is drawn at
        const atomLines = run.nowrap ? null : wrapStyledAtoms(styledAtoms(run), { maxWidth: wrapWidth - indent, atomWidth: a => widthOf(a.text, run.size, a.weight, font), mode });
        const lines = atomLines ? atomLines.map(l => l.map(a => a.text).join('')) : [run.text];
        const lineYs = lines.map(() => {
            relY += size;
            const y = relY;
            relY += size * (LINE_HEIGHT_EM - 1);
            return y;
        });
        relY += BOX_INNER_GAP;
        return { ...run, size, lines, lineYs, ...(size !== run.size ? { shrunkFrom: run.size } : {}), ...(run.spans && atomLines ? { lineSpans: atomLines.map(l => lineSpans(run, l)) } : {}) };
    });
    const textHeight = Math.max(0, relY - BOX_INNER_GAP);
    return { wrappedRuns, textHeight };
}
