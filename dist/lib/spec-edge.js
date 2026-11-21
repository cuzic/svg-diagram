// Drawing a JSON spec where there is no file system and no native code, such as a Cloudflare Worker ("svg-diagram/spec/edge"). The caller hands in
// the text engine; the result is an SVG with its text as outlines, so the picture does not depend on the fonts of whoever opens it.
import { renderInBrowser } from './web.js';
import { lintGeometry } from './svg-lint.js';
import { outlineText } from './svg-outline.js';
import { emojiMeasurer, emojiTextBox } from './emoji-edge.js';
import { SpecError, capped, cappedMessages, fieldsHolding, layoutIssue, lintMessages, locateMessage, locateVerdict, specToDiagram } from './spec.js';
export const MAX_EDGE_HEIGHT = 6000;
const nothing = (issues) => ({ ok: false, svg: null, width: 0, height: 0, issues, problems: [], findings: [] });
const messageOf = (e) => e instanceof Error ? e.message : String(e);
const clip = (s) => s.length <= 200 ? s : `${s.slice(0, 200)}…`;
/** The text engine failed, not the figure: telling the caller to change the spec would be wrong. Thrown out of renderSpecEdge(). */
export class TextEngineError extends Error {
    constructor(cause) {
        super(`the text engine failed: ${messageOf(cause)}`, { cause });
        this.name = 'TextEngineError';
    }
}
function guarded(f) {
    return (...a) => {
        try {
            const r = f(...a);
            return r instanceof Promise ? r.catch((e) => { throw new TextEngineError(e); }) : r;
        }
        catch (e) {
            throw new TextEngineError(e);
        }
    };
}
/** The engine with each of its failures turned into a TextEngineError (also used by ./pptx-edge.ts). */
export function guardedEngine({ measure, textBox, font }) {
    // an emoji is measured as the viewer's emoji font draws it (./emoji-edge.ts): the engine's font has none
    return {
        measure: emojiMeasurer(guarded(measure), guarded(font.covers.bind(font))),
        textBox: emojiTextBox(guarded(textBox), guarded(font.covers.bind(font))),
        font: { shape: guarded(font.shape.bind(font)), path: guarded(font.path.bind(font)), covers: guarded(font.covers.bind(font)) },
    };
}
export function missingIssues(spec, missing) {
    const issues = [];
    for (const char of new Set(missing.map(m => m.char))) {
        const code = char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
        const message = `"${char}" (U+${code}) cannot be drawn: the font has no glyph for it. Use Japanese or Latin text (emoji are fine)`;
        const fields = fieldsHolding(spec, char);
        for (const path of fields.length ? fields : [''])
            issues.push({ path, message });
    }
    return capped(issues);
}
/**
 * Draw and check a spec, and turn its text into outlines. A bad spec, a figure that does not fit, or a character the font lacks comes back in the
 * result, with its place. A failure of the engine that was handed in throws TextEngineError.
 */
export async function renderSpecEdge(spec, givenEngine, opts = {}) {
    const engine = guardedEngine(givenEngine);
    let d;
    try {
        d = specToDiagram(spec);
    }
    catch (e) {
        if (e instanceof SpecError)
            return nothing([...e.issues]);
        throw e;
    }
    let r;
    try {
        r = await renderInBrowser(d, { measure: engine.measure });
    }
    catch (e) {
        if (e instanceof TextEngineError)
            throw e;
        return nothing([layoutIssue(spec, e)]);
    }
    const maxHeight = opts.maxHeight ?? MAX_EDGE_HEIGHT;
    if (r.height > maxHeight)
        return nothing([{ path: '', message: `the figure is ${r.height}px tall; the limit is ${maxHeight}px. Use fewer steps or parts, or shorter text` }]);
    const { problems, findings } = locateVerdict(spec, r.verdict);
    for (const message of r.xml)
        problems.push({ path: locateMessage(spec, message), message, severity: 'problem' });
    if (r.xml.length)
        return { ok: false, svg: null, width: r.width, height: r.height, issues: [], problems: cappedMessages(problems), findings: cappedMessages(findings) };
    let svg;
    try {
        const checks = lintGeometry(r.svg, engine.textBox);
        if (checks) {
            const { errors, advisories } = lintMessages(checks);
            for (const message of errors)
                problems.push({ path: locateMessage(spec, message), message, severity: 'problem', rule: 'render-check' });
            for (const message of advisories)
                findings.push({ path: locateMessage(spec, message), message, severity: 'warn', rule: 'render-check' });
        }
        const outlined = outlineText(r.svg, engine.font, engine.textBox, { liveEmoji: true });
        if (outlined.missing.length)
            return nothing(missingIssues(spec, outlined.missing));
        if (outlined.unsupported.length)
            problems.push({ path: null, message: `the figure uses text features that outlines do not reproduce: ${outlined.unsupported.join(', ')}`, severity: 'problem', rule: 'outline' });
        svg = outlined.svg;
    }
    catch (e) {
        if (e instanceof TextEngineError)
            throw e;
        return { ok: false, svg: null, width: r.width, height: r.height, issues: [], problems: cappedMessages([...problems, { path: null, message: `the drawing could not be checked: ${clip(messageOf(e))}`, severity: 'problem', rule: 'render-check' }]), findings: cappedMessages(findings) };
    }
    return { ok: problems.length === 0, svg, width: r.width, height: r.height, issues: [], problems: cappedMessages(problems), findings: cappedMessages(findings) };
}
