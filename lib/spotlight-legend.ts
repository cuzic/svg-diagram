import {childrenOf, nestedBandsOf} from './band-children.ts';
import {connectSpotlight} from './emit-connect.ts';
import {rowSlot} from './emit-row.ts';
import {litEdge, spotlightEdges, spotlightIds} from './emit-spotlight.ts';
import type {DiagramData} from './types/core.ts';
import type {Band} from './types/index.ts';

/** Input bands outside the spotlight. Used before layout so auto legends ignore their notation. */
export function dimmedBands(d: Pick<DiagramData, 'bands' | 'spotlight'>): Set<Band> {
  const targets = new Set(spotlightIds(d));
  if (!targets.size) return new Set();
  const focused = new Set<Band>();
  const mark = (b: Band): void => {
    if (focused.has(b)) return;
    focused.add(b);
    nestedBandsOf(b).forEach(mark);
  };
  const walk = (bands: readonly Band[]): void => {
    for (const b of bands) {
      if ('id' in b && b.id && targets.has(b.id)) mark(b);
      if (b.type === 'row' || b.type === 'grouprow') {
        for (const id of targets) {
          const child = rowSlot(b, id);
          if (child) mark(child);
        }
      }
      walk(childrenOf(b));
    }
  };
  walk(d.bands);
  const focusedIds = new Set(targets);
  for (const b of focused) if ('id' in b && b.id) focusedIds.add(b.id);
  const between = spotlightEdges(d) === 'between';
  const refIsFocused = (ref: string): boolean => focusedIds.has(ref.split(':', 1)[0] ?? '');
  const dimmed = new Set<Band>();
  // Match the authored notation walk: children of figures (e.g. lane steps) are
  // included via their parent when it is focused.
  const collect = (bands: readonly Band[]): void => {
    for (const b of bands) {
      const ends = b.type === 'connect' ? connectSpotlight.endpoints?.(b) : undefined;
      if (!focused.has(b) && !(ends && litEdge(between, refIsFocused(ends[0]), refIsFocused(ends[1])))) dimmed.add(b);
      if ('children' in b && Array.isArray(b.children)) collect(b.children as Band[]);
    }
  };
  collect(d.bands);
  return dimmed;
}
