import {must} from './must.ts';
import type {LoopBack, RowBand} from './types/containers.ts';
import type {ChevronBand} from './flow-types.ts';

export interface LoopBackSource {
  loops: LoopBack | readonly LoopBack[];
  anchor(id: string, index: number): string;
}

export function rowLoopBack(row: RowBand): LoopBackSource | undefined {
  if (row.loopBack) return {loops: row.loopBack, anchor: (id, index) => `${id}#${index}`};
  return undefined;
}

export function chevronLoopBack(chevron: ChevronBand): LoopBackSource | undefined {
  if (!chevron.loopBack) return undefined;
  return {loops: chevron.loopBack, anchor(id, index) {
    const step = must(chevron.steps[index - 1]);
    return step.id ?? (step.id = `${id}__${index}`);
  }};
}
