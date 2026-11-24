// ADR 0072 D6: a map of the placed parts in viewBox coordinates.
import {frameGeometry} from './emit-box-frame.ts';
import {ganttBarGeometry} from './emit-gantt.ts';
import {primRectGeometry} from './emit-wireframe.ts';
import {layoutFinding} from './layout-issues.ts';
import type {ResolveSource} from './layout-issues.ts';
import {must} from './must.ts';
import {visibleAt} from './reveal.ts';
import {walkBands} from './rules.ts';
import {qualify, scopeOf} from './scope-name.ts';
import type {SourceLoc} from './source-location.ts';
import {sourceOf} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import type {LaidOutConnect} from './types/containers.ts';
import type {DiagramSource, Rect} from './types/core.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {Issue} from './types/verdicts.ts';
import {labelOf} from './verify-base.ts';
import {collectRects} from './verify-handlers.ts';

type At = {loc: SourceLoc; via?: Omit<SourceLoc, 'file'>[]};
type Life = {reveal?: number; until?: number};
type Visibility = Life & {final?: false};
type Part = At & Visibility & {kind: LaidOutBand['type']; label: string; rect: Rect; node?: string; generated?: true};
type Connection = At & Visibility & {kind: 'connect'; label?: string; rect: Rect; segments: [number, number, number, number][]};
export type LocationsProvenance = Pick<DiagramSource, 'sourceSha256' | 'configSha256' | 'noSourceLine'> & {depsSha256: string; tool: string};

function partLocation(ref: SourceRef | undefined, resolve: ResolveSource): At | undefined {
  if (!ref) return undefined;
  const {loc, via} = resolve(ref);
  return loc && {loc, ...(via.length ? {via: via.map(({line, column}) => ({line, column}))} : {})};
}

function rectOf({x, y, w, h}: Rect): Rect {
  return {x, y, w, h};
}

function drawsFrame(band: LaidOutBand, item?: number): boolean {
  switch (band.type) {
    case 'box':
    case 'group': return band.frame !== false;
    case 'banner': return true;
    case 'bowtie':
    case 'classes':
    case 'cloud':
    case 'fta':
    case 'tree': return item !== undefined;
    case 'cause': return item !== undefined && !must(band.nodes[item]).hex;
    case 'states': return item !== undefined && !must(band.nodes[item]).circle;
    case 'bpmn': return item !== undefined && must(band.nodes[item]).kind === 'task';
    default: return false;
  }
}

function itemRect(band: LaidOutBand, rect: Rect, index: number): Rect {
  if (band.type === 'gantt') {
    // Only tasks with IDs have anchors, so the anchor index need not be the bar index.
    const bar = band.bars.find(b => b.x === rect.x && b.y === rect.y && b.w === rect.w && b.h === rect.h);
    if (bar && !bar.milestone) return ganttBarGeometry(bar);
  }
  if (band.type === 'screens') {
    // The anchor includes the title above the frame. The frame shares its left, right and bottom edges.
    const bottom = rect.y + rect.h;
    const frame = band.prims.find(p => p.k === 'rect' && p.x === rect.x && p.w === rect.w &&
      p.y >= rect.y && Math.abs(p.y + p.h - bottom) < 1e-6);
    if (frame?.k === 'rect') return primRectGeometry(frame);
  }
  return drawsFrame(band, index) ? frameGeometry(rect) : rectOf(rect);
}

function lifeOf(part: object): Life {
  const {reveal, until} = part as Life;
  return {...(reveal === undefined ? {} : {reveal}), ...(until === undefined ? {} : {until})};
}

function visibility(life: Life, stage: number | undefined): Visibility {
  return visibleAt(life, stage) ? life : {...life, final: false};
}

function ownRect(band: LaidOutBand): Rect {
  if (band.type !== 'grid') return rectOf(band);
  // The placed grid stores its span and the heights of its individual cells.
  const {x, y, w} = band;
  return {x, y, w, h: Math.max(y, ...band.children.map(c => c.y + c.h)) - y};
}

function areaWrappers(diagram: LaidOutDiagram) {
  const rows = new Set<string>(), groups = new Set<string>();
  for (const band of walkBands(diagram.bands)) {
    if (band.type !== 'areas') continue;
    const ref = sourceOf(band);
    for (const cell of band.children) {
      if (cell.type === 'box' && cell.id) rows.add(cell.id);
      // areas() captures its own location for the frameless groups it creates.
      if (cell.type === 'group' && cell.id && ref && sourceOf(cell) === ref) groups.add(cell.id);
    }
  }
  return {rows, groups};
}

function partMap(diagram: LaidOutDiagram, band: LaidOutBand, resolve: ResolveSource, wrappers: ReturnType<typeof areaWrappers>): Part[] {
  // Collect per band to keep its type and the corresponding row/grid children.
  const rects = collectRects({...diagram, laidOut: [band]});
  const children = band.type === 'row' || band.type === 'grid' ? band.children : undefined;
  const parts: Part[] = [];
  const ref = sourceOf(band), at = partLocation(ref, resolve);
  const own = ownRect(band);
  const generated = (band.type === 'caption' && band.inkBox) ||
    (band.type === 'row' && band.children.length === 1 && wrappers.rows.has(band.children[0]?.id ?? '')) ||
    (band.type === 'group' && band.id && wrappers.groups.has(band.id));
  const origin = generated ? {generated: true as const} : {};
  if (at && (children || !rects.some(r => r.loc === ref && r.x === own.x && r.y === own.y && r.w === own.w && r.h === own.h))) {
    const node = 'id' in band ? band.id : undefined;
    const rect = drawsFrame(band) ? frameGeometry(own) : own;
    parts.push({...at, kind: band.type, label: labelOf(band), rect, ...(node ? {node} : {}), ...visibility(lifeOf(band), diagram.maxReveal), ...origin});
  }
  for (const [index, r] of rects.entries()) {
    const at = partLocation(r.loc, resolve);
    if (!at) continue;
    const part = children ? must(children[index]) : band;
    const synthetic = band.type === 'cause' && band.unanchored?.some(id => qualify(scopeOf(band), id) === r.id);
    const node = children && 'id' in part && part.id ? qualify(scopeOf(part), part.id) : synthetic ? undefined : r.id;
    const life = {...lifeOf(part), ...lifeOf(r.life ?? {})};
    const rect = itemRect(part, r, index);
    parts.push({...at, kind: part.type, label: r.label, rect, ...(node ? {node} : {}), ...visibility(life, diagram.maxReveal), ...(children ? {} : origin)});
  }
  return parts;
}

function connectionMap(c: LaidOutConnect, resolve: ResolveSource, stage: number | undefined): Connection[] {
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
  return [{...at, kind: 'connect', ...(c.label === undefined ? {} : {label: c.label}), rect: {x, y, w, h}, segments, ...visibility(lifeOf(c), stage)}];
}

export function locationsMap(diagram: LaidOutDiagram, source: string, provenance: LocationsProvenance, resolve: ResolveSource, issues?: readonly Issue[]) {
  const {loc} = resolve(sourceOf(diagram));
  const diagramLocation: {loc?: SourceLoc} = loc ? {loc} : {};
  const wrappers = areaWrappers(diagram);
  return {
    version: 1 as const,
    source,
    provenance,
    width: diagram.width,
    height: diagram.canvasHeight,
    diagram: diagramLocation,
    parts: diagram.laidOut.flatMap(band => partMap(diagram, band, resolve, wrappers)),
    connects: diagram.connects.flatMap(c => connectionMap(c, resolve, diagram.maxReveal)),
    ...(issues === undefined ? {} : {issues: issues.map(issue => layoutFinding(source, issue, resolve))}),
  };
}
