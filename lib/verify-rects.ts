import type {BandDef} from './band-def.ts';
import {qualify, scopeOf} from './scope-name.ts';
import type {LaidOutBand} from './types/index.ts';
import {sourceOf} from './source-ref.ts';
import type {LaidOutStatus} from './types/containers.ts';
import type {Rect} from './types/core.ts';
import type {LaidOutBox} from './types/text-bands.ts';
import type {CheckRect} from './types/verdicts.ts';
import {labelOf} from './verify-base.ts';

type Anchored = Rect & {id?: string; anchors: (Rect & {id: string})[]};
/** Each anchor is its own rect; `holds`: a connector that ends on the whole figure (its id) may run among them. */
export const anchorRects = (band: Anchored, intentional?: string): CheckRect[] =>
  band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h, ...((band.id || intentional) ? {holds: [band.id, intentional].filter((x): x is string => !!x)} : {})}));

export const figureRects = (band: Anchored): CheckRect[] => anchorRects(band);

/** An emblem's obstacle is the bounding box of each shape, not its anchor: a triangle's anchor leaves out its lower corners. */
export const emblemRects = (band: Anchored & {bounds?: Anchored['anchors']}): CheckRect[] => anchorRects({...band, anchors: band.bounds ?? band.anchors});

export const overlappingFigureRects = (band: Anchored): CheckRect[] => anchorRects(band, `@intentional-overlap:${band.x},${band.y}`);

export const childRects = (band: {children: LaidOutBox[]}): CheckRect[] => band.children.map(c => {
  const loc = sourceOf(c);
  return {id: c.id ?? null, label: labelOf(c), x: c.x, y: c.y, w: c.w, h: c.h, ...(loc ? {loc} : {})};
});

export const statusRects = (band: LaidOutStatus): CheckRect[] => [{id: null, label: 'status badge', ...band.pill}];

/** A rect of a scoped band answers to the names a connect() holds (`plan.p0`), not the bare ids the band's own output keeps (ADR 0012). The band's own id is a name of the whole figure. */
export function scopedRect(band: {type: string; id?: string}, scope: string, r: CheckRect): CheckRect {
  const own = band.type === 'box' ? undefined : band.id; // a swimlane step is a box: its id is the item's
  const name = (id: string): string => id === own || id.startsWith('@') ? id : qualify(scope, id);
  return {...r, id: r.id === null ? null : name(r.id), ...(r.holds ? {holds: r.holds.map(name)} : {})};
}

export const frameRects = (band: {anchors: (Rect & {id: string})[]}): CheckRect[] => band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h}));

export const ownRect = (band: Rect & {id?: string}): CheckRect[] => [{id: band.id ?? null, label: labelOf(band), x: band.x, y: band.y, w: band.w, h: band.h}];

/** Every checkable rect of a laid-out figure, in band order: what each band's definition lists, or the band as a whole when it lists none. */
export function collectRectsWith(figure: {laidOut: readonly LaidOutBand[]}, definitionOf: (band: LaidOutBand) => BandDef | undefined): CheckRect[] {
  return figure.laidOut.flatMap(band => {
    const def = definitionOf(band);
    const rects = def?.verify?.rects?.(band as never) ?? ('h' in band ? ownRect(band) : []);
    const scope = def?.rectsQualified ? undefined : scopeOf(band), loc = sourceOf(band);
    return rects.map(rect => {
      const located = loc && !rect.loc ? {...rect, loc} : rect;
      return scope ? scopedRect(band, scope, located) : located;
    });
  });
}
