import {finishDeckFile, readDeckFile, type LoadDeckResult} from './deck-file.ts';
import {validateDeckWithAsync} from './deck-spec-core.ts';
import {loadSpecPartsFor} from './spec-cli-parts.ts';
import {validateSpec} from './spec-selective.ts';
import type {SpecIssue} from './spec-kit.ts';

async function validateFigure(figure: unknown): Promise<SpecIssue[]> {
  const selected = await loadSpecPartsFor(figure);
  if (selected) {
    const issues = validateSpec(figure, {
      parts: selected,
      autoLegend: (figure as {legend?: unknown}).legend === 'auto'
        ? (await import('./bands/legend.ts')).autoLegend : undefined,
    });
    if (!issues.length) return issues;
  }
  // Preserve the full catalog's messages for malformed figures, including the list of valid part names.
  const {validateSpec: validateFullSpec} = await import('./spec.ts');
  return validateFullSpec(figure);
}

/** Resolve a deck and load only the definitions used by each valid JSON figure. */
export async function loadDeckSelective(deckFile: string): Promise<LoadDeckResult> {
  const read = readDeckFile(deckFile);
  return read.ok ? finishDeckFile(read.loaded, await validateDeckWithAsync(read.checked, validateFigure)) : read;
}
