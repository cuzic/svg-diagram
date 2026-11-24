import {finishDeckFile, readDeckFile, type LoadDeckResult} from './deck-file.ts';
import {validateDeckWithAsync} from './deck-spec-core.ts';
import {specPartLoaders} from './spec-cli-parts.ts';
import {validateSpec, type SelectedPart} from './spec-selective.ts';
import {MAX_SPEC_PARTS, type SpecIssue} from './spec-kit.ts';

async function validateFigure(figure: unknown): Promise<SpecIssue[]> {
  const parts = (figure as {parts?: unknown} | null)?.parts;
  if (Array.isArray(parts) && parts.length > 0 && parts.length <= MAX_SPEC_PARTS) {
    const names = new Set(parts.map(part => (part as {type?: unknown} | null)?.type));
    const loaders: (() => Promise<SelectedPart>)[] = [];
    for (const name of names) {
      if (typeof name !== 'string' || !Object.hasOwn(specPartLoaders, name)) break;
      const load = specPartLoaders[name];
      if (load) loaders.push(load);
    }
    if (loaders.length === names.size) {
      const selected = await Promise.all(loaders.map(load => load()));
      const issues = validateSpec(figure, {
        parts: selected,
        autoLegend: (figure as {legend?: unknown}).legend === 'auto'
          ? (await import('./bands/legend.ts')).autoLegend : undefined,
      });
      if (!issues.length) return issues;
    }
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
