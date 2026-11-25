import {EMIT_HANDLERS} from './emit-handlers.ts';
import {addScoped, emptyScopes} from './scope-table.ts';
import {qualify, scopeOf} from './scope-name.ts';
import {applySpotlightWith} from './emit-spotlight.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';

export {dimmedBands} from './spotlight-legend.ts';
export {spotlightIds, spotlightDim, spotlightEdges} from './emit-spotlight.ts';

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
