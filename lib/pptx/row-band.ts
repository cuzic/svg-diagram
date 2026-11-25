import {boxPptx} from './box-band.ts';
import type {LaidOutOf} from '../band-table.ts';
import {visibleAt} from '../reveal-visibility.ts';
import {must} from '../must.ts';
import {fitConnector, siteIndex} from './geom.ts';
import {namedAs} from './prims.ts';
import {groupXml} from './shapes.ts';
import {rowArrowXml} from './row-arrow.ts';
import type {Glue} from './connector-geometry-xml.ts';
import type {BandXml} from './adapter.ts';

export const rowPptx: BandXml<LaidOutOf<'row'>> = (band, ctx) => {
  const gid = ctx.next();
  const inner = band.children.filter(c => visibleAt(c, ctx.stage)).map(c => boxPptx(c, ctx)).join('');
  const group = groupXml(gid, namedAs('row', '', band.id), band, inner);
  const nearest = (x: number, y: number) => band.children.map(c => ({c, d: Math.min(Math.abs(x - c.x), Math.abs(x - c.x - c.w), Math.abs(y - c.y), Math.abs(y - c.y - c.h))})).sort((u, v) => u.d - v.d)[0];
  const rowGlue = (x: number, y: number): Glue | undefined => {
    const n = nearest(x, y), shape = n?.c.id ? ctx.glue.get(n.c.id) : undefined;
    return n && shape && n.d <= 2 ? {id: shape.id, idx: siteIndex(n.c, {x, y}, '')} : undefined;
  };
  const arrows = band.arrows.flatMap((a, i) => {
    if (ctx.stage !== undefined && (!visibleAt(must(band.children[i]), ctx.stage) || !visibleAt(must(band.children[i + 1]), ctx.stage))) return [];
    const fit = fitConnector([{x: a.x1, y: a.y1}, {x: a.x2, y: a.y2}]);
    return fit.ok ? [rowArrowXml(ctx.next(), `row-arrow-${i}`, fit.x, rowGlue(a.x1, a.y1), rowGlue(a.x2, a.y2))] : [];
  });
  return group + arrows.join('');
};
