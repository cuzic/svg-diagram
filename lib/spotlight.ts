import {childrenOf, nestedBandsOf} from './band-children.ts';
import {EMIT_HANDLERS} from './emit-handlers.ts';
import {connectSpotlight} from './emit-connect.ts';
import {rowSlot} from './emit-row.ts';
import {addScoped, emptyScopes} from './scope-table.ts';
import {qualify, scopeOf} from './scope-name.ts';
import {applySpotlightWith, litEdge, spotlightEdges, spotlightIds} from './emit-spotlight.ts';
import type {DiagramData} from './types/core.ts';
import type {Band, LaidOutBand, LaidOutDiagram} from './types/index.ts';

export {spotlightIds, spotlightDim, spotlightEdges} from './emit-spotlight.ts';

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

function spotlightOf(laid: LaidOutBand) {
  const handler = EMIT_HANDLERS[laid.type];
  return 'spotlight' in handler ? handler.spotlight : undefined;
}

export function applySpotlight(d: LaidOutDiagram): void {
  if (!d.spotlight) return;
  const scopes = emptyScopes();
  for (const band of d.laidOut) {
    const scope = scopeOf(band);
    if (!scope) continue;
    const hooks = spotlightOf(band);
    if (hooks && 'scopedId' in hooks && hooks.scopedId && 'id' in band && band.id) addScoped(scopes, scope, band.id);
    const skip = (band as {unanchored?: readonly string[]}).unanchored;
    for (const a of (band as {anchors?: {id: string}[]}).anchors ?? []) {
      if (a.id && !skip?.includes(a.id)) addScoped(scopes, scope, a.id);
    }
  }
  applySpotlightWith(d, spotlightOf, scopes, missing => {
    const inFigure = missing.find(id => d.laidOut.some(band =>
      'anchors' in band && band.anchors.some(a => qualify(scopeOf(band), a.id) === id)));
    if (inFigure) throw new Error(`diagram({spotlight}): "${inFigure}" is a node inside a figure; spotlight lights a whole figure, so give the figure an {id} and spotlight that (to light one branch of a tree or mindmap, write its focus: '${inFigure}')`);
    throw new Error(`diagram({spotlight}): unknown anchor id${missing.length > 1 ? 's' : ''} "${missing.join('", "')}"`);
  });
}
