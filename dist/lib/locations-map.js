// ADR 0072 D6: a map of the placed parts in viewBox coordinates.
import { frameGeometry } from './emit-box-frame.js';
import { layoutFinding } from './layout-issues.js';
import { must } from './must.js';
import { visibleAt } from './reveal-visibility.js';
import { walkAnyBands as walkBands } from './full-definitions.js';
import { qualify, scopeOf } from './scope-name.js';
import { sourceOf } from './source-ref.js';
import { labelOf } from './verify-base.js';
import { collectRects, placedDefinitionOf } from './placed-definitions.js';
function partLocation(ref, resolve) {
    if (!ref)
        return undefined;
    const { loc, via } = resolve(ref);
    return loc && { loc, ...(via.length ? { via: via.map(({ line, column }) => ({ line, column })) } : {}) };
}
function rectOf({ x, y, w, h }) {
    return { x, y, w, h };
}
function drawsFrame(band, item) {
    return placedDefinitionOf(band)?.locations?.drawsFrame?.(band, item) ?? false;
}
function itemRect(band, rect, index) {
    const own = placedDefinitionOf(band)?.locations?.itemRect?.(band, rect, index);
    if (own)
        return own;
    return drawsFrame(band, index) ? frameGeometry(rect) : rectOf(rect);
}
function lifeOf(part) {
    const { reveal, until } = part;
    return { ...(reveal === undefined ? {} : { reveal }), ...(until === undefined ? {} : { until }) };
}
function visibility(life, stage) {
    return visibleAt(life, stage) ? life : { ...life, final: false };
}
function ownRect(band) {
    if (band.type !== 'grid')
        return rectOf(band);
    // The placed grid stores its span and the heights of its individual cells.
    const { x, y, w } = band;
    return { x, y, w, h: Math.max(y, ...band.children.map(c => c.y + c.h)) - y };
}
function areaWrappers(diagram) {
    const rows = new Set(), groups = new Set();
    for (const band of walkBands(diagram.bands)) {
        if (band.type !== 'areas')
            continue;
        const ref = sourceOf(band);
        for (const cell of band.children) {
            if (cell.type === 'box' && cell.id)
                rows.add(cell.id);
            // areas() captures its own location for the frameless groups it creates.
            if (cell.type === 'group' && cell.id && ref && sourceOf(cell) === ref)
                groups.add(cell.id);
        }
    }
    return { rows, groups };
}
function partMap(diagram, band, resolve, wrappers) {
    // Collect per band to keep its type and the corresponding row/grid children.
    const rects = collectRects({ ...diagram, laidOut: [band] });
    const children = band.type === 'row' || band.type === 'grid' ? band.children : undefined;
    const parts = [];
    const ref = sourceOf(band), at = partLocation(ref, resolve);
    const own = ownRect(band);
    const generated = (band.type === 'caption' && band.inkBox) ||
        (band.type === 'row' && band.children.length === 1 && wrappers.rows.has(band.children[0]?.id ?? '')) ||
        (band.type === 'group' && band.id && wrappers.groups.has(band.id));
    const origin = generated ? { generated: true } : {};
    if (at && (children || !rects.some(r => r.loc === ref && r.x === own.x && r.y === own.y && r.w === own.w && r.h === own.h))) {
        const node = 'id' in band ? band.id : undefined;
        const rect = drawsFrame(band) ? frameGeometry(own) : own;
        parts.push({ ...at, kind: band.type, label: labelOf(band), rect, ...(node ? { node } : {}), ...visibility(lifeOf(band), diagram.maxReveal), ...origin });
    }
    for (const [index, r] of rects.entries()) {
        const at = partLocation(r.loc, resolve);
        if (!at)
            continue;
        const part = children ? must(children[index]) : band;
        const synthetic = r.id != null && placedDefinitionOf(band)?.locations?.synthetic?.(band, r.id) === true;
        const node = children && 'id' in part && part.id ? qualify(scopeOf(part), part.id) : synthetic ? undefined : r.id;
        const life = { ...lifeOf(part), ...lifeOf(r.life ?? {}) };
        const rect = itemRect(part, r, index);
        parts.push({ ...at, kind: part.type, label: r.label, rect, ...(node ? { node } : {}), ...visibility(life, diagram.maxReveal), ...(children ? {} : origin) });
    }
    return parts;
}
function connectionMap(c, resolve, stage) {
    const at = partLocation(sourceOf(c), resolve);
    if (!at)
        return [];
    const label = c.chipBox ?? c.labelBox;
    const boxes = label ? [...c.pathSegments, label] : c.pathSegments;
    // A route normally has at least one segment. Coincident endpoints still have a position.
    const x = Math.min(c.from.x, ...boxes.map(r => r.x));
    const y = Math.min(c.from.y, ...boxes.map(r => r.y));
    const w = Math.max(c.to.x, ...boxes.map(r => r.x + r.w)) - x;
    const h = Math.max(c.to.y, ...boxes.map(r => r.y + r.h)) - y;
    const segments = c.points.slice(1).map((end, i) => {
        const start = must(c.points[i]);
        return [start.x, start.y, end.x, end.y];
    });
    return [{ ...at, kind: 'connect', ...(c.label === undefined ? {} : { label: c.label }), rect: { x, y, w, h }, segments, ...visibility(lifeOf(c), stage) }];
}
export function locationsMap(diagram, source, provenance, resolve, issues) {
    const { loc } = resolve(sourceOf(diagram));
    const diagramLocation = loc ? { loc } : {};
    const wrappers = areaWrappers(diagram);
    return {
        version: 1,
        source,
        provenance,
        width: diagram.width,
        height: diagram.canvasHeight,
        diagram: diagramLocation,
        parts: diagram.laidOut.flatMap(band => partMap(diagram, band, resolve, wrappers)),
        connects: diagram.connects.flatMap(c => connectionMap(c, resolve, diagram.maxReveal)),
        ...(issues === undefined ? {} : { issues: issues.map(issue => layoutFinding(source, issue, resolve)) }),
    };
}
