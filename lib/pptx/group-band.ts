import type {LaidOutOf} from '../band-table.ts';
import {register} from './adapter.ts';
import type {BandXml} from './adapter.ts';
import {namedAs} from './prims.ts';
import {groupFrameXml} from './shapes.ts';

export const groupPptx: BandXml<LaidOutOf<'group'>> = (band, ctx) => {
  const id = ctx.next();
  register(ctx, band.id, id, band);
  return groupFrameXml(id, namedAs('frame', '', band.id), band, band.tone, band.dashed, ctx.ld.day, ctx.tones);
};
