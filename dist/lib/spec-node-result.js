import { geometryChecks } from './geometry-checks.js';
import { cappedMessages, lintMessages, locateMessage, locateVerdict, messageOf } from './spec-result.js';
/** The tallest figure renderSpec() returns by default. */
export const MAX_FIGURE_HEIGHT = 8000;
/** The five checks on a drawn SVG (contrast, past the canvas, text over text, text out of its box, a shape over a text), from the SVG's own geometry; no file, no browser. null when `svg` has no <svg>. The colour-token and font-size rules of `svg-diagram lint` are not here. */
export function lintRendering(svg, opts = {}) {
    return geometryChecks(svg, opts.fonts);
}
export const nothing = (issues) => ({ ok: false, svg: null, width: 0, height: 0, issues, problems: [], findings: [] });
/** A failure of this machine (a font file, the browser), as opposed to a figure that cannot be drawn: telling the caller to change the spec would be wrong. */
export const isInfrastructure = (e) => e instanceof Error && (typeof e.code === 'string' || /^measure:|font file|Chromium|playwright/i.test(e.message));
export function finishNodeSpec(spec, r, maxHeight, fonts) {
    if (r.height > maxHeight)
        return nothing([{ path: '', message: `the figure is ${r.height}px tall; the limit is ${maxHeight}px. Use fewer steps or parts, or shorter text` }]);
    const { problems, findings } = locateVerdict(spec, r.verdict);
    for (const message of r.xml)
        problems.push({ path: locateMessage(spec, message), message, severity: 'problem' });
    if (r.xml.length === 0) {
        try {
            const checks = lintRendering(r.svg, { fonts: fonts });
            if (checks) {
                const { errors, advisories } = lintMessages(checks);
                for (const message of errors)
                    problems.push({ path: locateMessage(spec, message), message, severity: 'problem', rule: 'render-check' });
                for (const message of advisories)
                    findings.push({ path: locateMessage(spec, message), message, severity: 'warn', rule: 'render-check' });
            }
        }
        catch (e) {
            if (isInfrastructure(e))
                throw e;
            problems.push({ path: null, message: `the drawing could not be checked: ${messageOf(e)}`, severity: 'problem', rule: 'render-check' });
        }
    }
    return { ok: problems.length === 0, svg: r.svg, width: r.width, height: r.height, issues: [], problems: cappedMessages(problems), findings: cappedMessages(findings) };
}
