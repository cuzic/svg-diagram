import {contentExtent, extentOf, unionOf} from './figure-metrics.ts';
import type {DiagramData, Rect} from './types/core.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';

/** Lay out again at the width the content needs. Allow up to three rounds as it reflows, keeping the previous layout if a round does not fit. */
export async function layoutFitted(d: DiagramData, layout: () => LaidOutDiagram | Promise<LaidOutDiagram>): Promise<LaidOutDiagram> {
  let laidOut = await layout();
  for (let i = 0; d.fitWidth && i < 3; i++) {
    const next = fitWidthOf(laidOut.laidOut, d.pad);
    if (next === undefined || next >= d.width) break;
    const before = d.width;
    d.width = next;
    const again = await layout();
    const need = fitWidthOf(again.laidOut, d.pad);
    if (need !== undefined && need > next) { d.width = before; break; }
    laidOut = again;
  }
  return laidOut;
}

/** Content width plus both sides of padding, rounded up to the 4px grid. */
function fitWidthOf(bands: LaidOutBand[], pad: number): number | undefined {
  const box = contentBox(bands, true);
  return box ? Math.max(320, Math.ceil((box.w + 2 * pad) / 4) * 4) : undefined;
}

/** Everything the figure shows, as one rect (labels of shapes included). Captions (titles and the source line), the status strip and legends are furniture, not the figure. */
export function contentBox(laidOut: LaidOutBand[], tight = false): Rect | null {
  return contentExtent(laidOut, tight ? b => drawnExtent(b) ?? extentOf(b) : extentOf);
}

/** What a flow shape (chevron, funnel, cycle, venn, concentric) actually draws: its circles, rects, polygons and texts, not the band's full-width rect. undefined for any other band. */
function drawnExtent(b: LaidOutBand): Rect | null | undefined {
  if (b.type !== 'chevron' && b.type !== 'funnel' && b.type !== 'cycle' && b.type !== 'venn' && b.type !== 'concentric' && b.type !== 'emblem' && b.type !== 'valueChain') return undefined;
  const rs: Rect[] = [...b.texts];
  for (const p of b.primitives) {
    if (p.k === 'circle') rs.push({x: p.cx - p.r, y: p.cy - p.r, w: 2 * p.r, h: 2 * p.r});
    else if (p.k === 'rect') rs.push({x: p.x, y: p.y, w: p.w, h: p.h});
    else if (p.k === 'path' && p.box) rs.push(p.box); // a filled shape (an emblem's pill / cylinder ...); a line has no extent of its own
    else if (p.k === 'polygon' && p.points.length) { const xs = p.points.map(q => q[0]), ys = p.points.map(q => q[1]); rs.push({x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)}); }
  }
  return unionOf(rs);
}
