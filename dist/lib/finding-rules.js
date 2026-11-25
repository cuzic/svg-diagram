// Source references stay lazy until the CLI resolves a finding.
import { sourceOf } from './source-ref.js';
/** The first marked part is the primary location; the other marked parts are related. */
export function at(band, ...relatedBands) {
    const loc = band && sourceOf(band);
    if (!relatedBands.length)
        return loc ? { loc } : {};
    return fromSources([loc, ...relatedBands.map(b => sourceOf(b))]);
}
export function fromSources(refs) {
    const sources = new Set();
    // Keep one primary and at most ten distinct related locations.
    for (const ref of refs) {
        if (ref)
            sources.add(ref);
        if (sources.size === 11)
            break;
    }
    const [loc, ...related] = sources;
    return loc ? { loc, ...(related.length ? { related } : {}) } : {};
}
/** Band analysis can specify a fixed severity or inherit the diagram's default. */
export function analysisFindings(band, notes, severity = 'info') {
    return notes.map(note => ({ ...at(band), ...note, severity: note.severity ?? severity }));
}
/** Keep an accepted finding at information level and record the author's reason. */
export function applyFindingAcceptance(finding, accept) {
    const why = accept?.[finding.rule]
        ?? (finding.rule === 'toc-no-desired-result' ? accept?.['toc-parts'] : undefined);
    return why ? { ...finding, severity: 'info', message: `${finding.message}（許容: ${why}）` } : finding;
}
/** Format the guidance for a documented rule. */
export function findingAcceptanceHint(rule) {
    return `許容するなら diagram({accept: {'${rule}': '理由'}}) か .svg-diagram.json の {"accept": {"${rule}": "理由"}}（詳しくは check --explain ${rule}）`;
}
