// ADR 0072 D6: a map of the placed parts in viewBox coordinates.
import {layoutFinding} from './layout-issues.ts';
import type {ResolveSource} from './layout-issues.ts';
import {must} from './must.ts';
import {qualify, scopeOf} from './scope-name.ts';
import type {SourceLoc} from './source-location.ts';
import {sourceOf} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import type {LaidOutConnect} from './types/containers.ts';
import type {Rect} from './types/core.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {Issue} from './types/verdicts.ts';
import {labelOf} from './verify-base.ts';
import {collectRects} from './verify-handlers.ts';

type At = {loc: SourceLoc; via?: Omit<SourceLoc, 'file'>[]};
type Life = {reveal?: number; until?: number};
type Part = At & Life & {kind: LaidOutBand['type']; label: string; rect: Rect; node?: string};
type Connection = At & Life & {kind: 'connect'; label?: string; rect: Rect; segments: [number, number, number, number][]};

function partLocation(ref: SourceRef | undefined, resolve: ResolveSource): At | undefined {
  if (!ref) return undefined;
  const {loc, via} = resolve(ref);
  return loc && {loc, ...(via.length ? {via: via.map(({line, column}) => ({line, column}))} : {})};
}

function rectOf({x, y, w, h}: Rect): Rect {
  return {x, y, w, h};
}

function lifeOf(part: object): Life {
  const {reveal, until} = part as Life;
  return {...(reveal === undefined ? {} : {reveal}), ...(until === undefined ? {} : {until})};
}

function ownRect(band: LaidOutBand): Rect {
  if (band.type !== 'grid') return rectOf(band);
  // The placed grid stores its span and the heights of its individual cells.
  const {x, y, w} = band;
  return {x, y, w, h: Math.max(y, ...band.children.map(c => c.y + c.h)) - y};
}

function partMap(diagram: LaidOutDiagram, band: LaidOutBand, resolve: ResolveSource): Part[] {
  // Collect per band to keep its type and the corresponding row/grid children.
  const rects = collectRects({...diagram, laidOut: [band]});
  const children = band.type === 'row' || band.type === 'grid' ? band.children : undefined;
  const parts: Part[] = [];
  const ref = sourceOf(band), at = partLocation(ref, resolve);
  const own = ownRect(band);
  if (at && (children || !rects.some(r => r.loc === ref && r.x === own.x && r.y === own.y && r.w === own.w && r.h === own.h))) {
    const node = 'id' in band ? band.id : undefined;
    parts.push({...at, kind: band.type, label: labelOf(band), rect: own, ...(node ? {node} : {}), ...lifeOf(band)});
  }
  for (const [index, r] of rects.entries()) {
    const at = partLocation(r.loc, resolve);
    if (!at) continue;
    const part = children ? must(children[index]) : band;
    const synthetic = band.type === 'cause' && band.unanchored?.some(id => qualify(scopeOf(band), id) === r.id);
    const node = children && 'id' in part && part.id ? qualify(scopeOf(part), part.id) : synthetic ? undefined : r.id;
    parts.push({...at, kind: part.type, label: r.label, rect: rectOf(r), ...(node ? {node} : {}), ...lifeOf(part), ...lifeOf(r.life ?? {})});
  }
  return parts;
}

function connectionMap(c: LaidOutConnect, resolve: ResolveSource): Connection[] {
  const at = partLocation(sourceOf(c), resolve);
  if (!at) return [];
  const label = c.chipBox ?? c.labelBox;
  const boxes = label ? [...c.pathSegments, label] : c.pathSegments;
  // A route normally has at least one segment. Coincident endpoints still have a position.
  const x = Math.min(c.from.x, ...boxes.map(r => r.x));
  const y = Math.min(c.from.y, ...boxes.map(r => r.y));
  const w = Math.max(c.to.x, ...boxes.map(r => r.x + r.w)) - x;
  const h = Math.max(c.to.y, ...boxes.map(r => r.y + r.h)) - y;
  const segments = c.points.slice(1).map((end, i): Connection['segments'][number] => {
    const start = must(c.points[i]);
    return [start.x, start.y, end.x, end.y];
  });
  return [{...at, kind: 'connect', ...(c.label === undefined ? {} : {label: c.label}), rect: {x, y, w, h}, segments, ...lifeOf(c)}];
}

export function locationsMap(diagram: LaidOutDiagram, source: string, resolve: ResolveSource, issues?: readonly Issue[]) {
  const {loc} = resolve(sourceOf(diagram));
  const diagramLocation: {loc?: SourceLoc} = loc ? {loc} : {};
  return {
    version: 1 as const,
    source,
    width: diagram.width,
    height: diagram.canvasHeight,
    diagram: diagramLocation,
    parts: diagram.laidOut.flatMap(band => partMap(diagram, band, resolve)),
    connects: diagram.connects.flatMap(c => connectionMap(c, resolve)),
    ...(issues === undefined ? {} : {issues: issues.map(issue => layoutFinding(source, issue, resolve))}),
  };
}
