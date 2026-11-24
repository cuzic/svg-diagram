import {qualify} from './scope-name.ts';
import type {Rect} from './types/core.ts';
import type {CheckRect} from './types/verdicts.ts';
import {labelOf} from './verify-base.ts';

type Anchored = Rect & {id?: string; anchors: (Rect & {id: string})[]};
/** Each anchor is its own rect; `holds`: a connector that ends on the whole figure (its id) may run among them. */
export const anchorRects = (band: Anchored, intentional?: string): CheckRect[] =>
  band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h, ...((band.id || intentional) ? {holds: [band.id, intentional].filter((x): x is string => !!x)} : {})}));

/** A rect of a scoped band answers to the names a connect() holds (`plan.p0`), not the bare ids the band's own output keeps (ADR 0012). The band's own id is a name of the whole figure. */
export function scopedRect(band: {type: string; id?: string}, scope: string, r: CheckRect): CheckRect {
  const own = band.type === 'box' ? undefined : band.id; // a swimlane step is a box: its id is the item's
  const name = (id: string): string => id === own || id.startsWith('@') ? id : qualify(scope, id);
  return {...r, id: r.id === null ? null : name(r.id), ...(r.holds ? {holds: r.holds.map(name)} : {})};
}

export const frameRects = (band: {anchors: (Rect & {id: string})[]}): CheckRect[] => band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h}));

export const ownRect = (band: Rect & {id?: string}): CheckRect[] => [{id: band.id ?? null, label: labelOf(band), x: band.x, y: band.y, w: band.w, h: band.h}];
