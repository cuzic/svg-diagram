import { finishDeckFile, readDeckFile } from './deck-file.js';
import { validateDeckWithAsync } from './deck-spec-core.js';
import { loadSpecPartsFor } from './spec-cli-parts.js';
import { validateSpec } from './spec-selective.js';
async function validateFigure(figure) {
    const selected = await loadSpecPartsFor(figure);
    if (selected) {
        const issues = validateSpec(figure, {
            parts: selected,
            autoLegend: figure.legend === 'auto'
                ? (await import('./bands/legend.js')).autoLegend : undefined,
        });
        if (!issues.length)
            return issues;
    }
    // Preserve the full catalog's messages for malformed figures, including the list of valid part names.
    const { validateSpec: validateFullSpec } = await import('./spec.js');
    return validateFullSpec(figure);
}
/** Resolve a deck and load only the definitions used by each valid JSON figure. */
export async function loadDeckSelective(deckFile) {
    const read = readDeckFile(deckFile);
    return read.ok ? finishDeckFile(read.loaded, await validateDeckWithAsync(read.checked, validateFigure)) : read;
}
