import {qualify, scopeOf} from './scope-name.ts';
import type {ComicLaidBubble, LaidOutComic} from './types/comic.ts';
import type {CheckRect} from './types/verdicts.ts';

export function comicSlotOwners(band: LaidOutComic): Map<string, ComicLaidBubble> {
  const owners = new Map<string, ComicLaidBubble>();
  for (const bubble of band.bubbles) for (const {id} of bubble.slots) {
    // Layout registers only the first anchor when a worksheet repeats a slot id.
    if (!owners.has(id)) owners.set(id, bubble);
  }
  return owners;
}

export function comicRects(band: LaidOutComic): CheckRect[] {
  const scope = scopeOf(band), owners = comicSlotOwners(band);
  return band.panels.map(({id, x, y, w, h}) => {
    const holds = band.id ? [band.id] : [];
    for (const [slot, bubble] of owners) if (bubble.panel === id) holds.push(qualify(scope, slot));
    return {id: qualify(scope, id), label: `comic panel ${id}`, x, y, w, h, holds};
  });
}
