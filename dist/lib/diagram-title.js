import { visibleAt } from './reveal-visibility.js';
import { defOf, walkDefinedBands } from './band-def.js';
import { oneLine } from './diagram-description.js';
/** An explicit title wins; otherwise take the first eligible band at the best priority. */
export function definedDiagramTitle({ title, bands }, stage) {
    if (title)
        return oneLine(title);
    let best;
    for (const band of walkDefinedBands(bands)) {
        if (!visibleAt(band, stage))
            continue;
        const candidate = defOf(band)?.title?.(band);
        if (!candidate)
            continue;
        if (candidate[0] === 0)
            return oneLine(candidate[1]);
        if (!best || candidate[0] < best[0])
            best = candidate;
    }
    return oneLine(best?.[1]);
}
