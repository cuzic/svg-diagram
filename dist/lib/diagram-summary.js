// The SVG accessible name and description of a laid-out figure (<title> / <desc>), read from the band values by kind.
// Kept apart from rules.ts so the emitters (emit.ts, the PPTX slide planner) do not pull the whole rule catalog.
import { describeBands, oneLine } from './diagram-description.js';
import { walkBands } from './legend-notation.js';
import { statusText } from './status.js';
export function diagramTitle(d) {
    if (d.title)
        return oneLine(d.title);
    for (const b of walkBands(d.bands)) {
        if (b.type === 'caption' && b.text)
            return oneLine(b.text);
        if (b.type === 'banner' && b.headline)
            return oneLine(b.headline);
    }
    for (const b of walkBands(d.bands))
        if (b.type === 'group' && b.title)
            return oneLine(b.title);
    for (const b of walkBands(d.bands)) {
        if (b.type === 'chevron' || b.type === 'cycle')
            return oneLine(b.steps[0]?.label);
        if (b.type === 'funnel')
            return oneLine(b.stages[0]?.label);
        if (b.type === 'venn')
            return oneLine(b.sets.map(s => s.label ?? s.name).join('・'));
        if (b.type === 'concentric')
            return oneLine(b.centre ?? b.rings[0]?.label);
        if (b.type === 'emblem')
            return oneLine(b.items[0]?.label);
        if (b.type === 'valueChain')
            return oneLine(b.primary[0]?.label);
        if (b.type === 'wordart')
            return oneLine(b.text);
    }
    return '';
}
/** `stage`: a click stage of a revealing diagram; only what is on screen then is listed (nothing is left out without it). */
export function diagramDesc(d, stage) {
    const text = d.desc ? oneLine(d.desc) : describeBands(walkBands(d.bands), stage);
    // a figure with a status says so first, in the badge's own wording ("(下書き)"); one without is unchanged
    return d.status === undefined ? text : `(${statusText(d)})${text ? ` ${text}` : ''}`;
}
