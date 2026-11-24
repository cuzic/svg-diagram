import type {LaidOutOf} from '../band-table.ts';
import {visibleAt} from '../reveal-visibility.ts';
import {boxPptx} from './box-band.ts';
import {groupXml} from './shapes.ts';
import type {BandXml} from './adapter.ts';
import type {Rect} from './xml.ts';

const verticalExtent = (children: Rect[]): {y: number; h: number} => {
  const y = Math.min(...children.map(c => c.y));
  return {y, h: Math.max(...children.map(c => c.y + c.h)) - y};
};

export const gridPptx: BandXml<LaidOutOf<'grid'>> = (band, ctx) => {
  const gid = ctx.next();
  const inner = band.children.filter(c => visibleAt(c, ctx.stage)).map(c => boxPptx(c, ctx)).join('');
  return groupXml(gid, 'grid', {...verticalExtent(band.children), x: band.x, w: band.w}, inner);
};
