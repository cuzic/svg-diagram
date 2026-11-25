import type {LaidOutOf} from '../band-table.ts';
import {register} from './adapter.ts';
import type {BandXml} from './adapter.ts';
import {stampBadge, textOf} from './box-decoration.ts';
import {namedAs} from './prims.ts';
import {boxXml, groupXml} from './shapes.ts';

export const bannerPptx: BandXml<LaidOutOf<'banner'>> = (banner, ctx) => {
  const id = ctx.next();
  register(ctx, banner.id, id, banner);
  const text = textOf(banner);
  const main = boxXml(id, namedAs('box', text, banner.id), banner, ctx.ld.day, ctx.tones, ctx.fonts);
  if (!banner.stamp) return main;
  const stamp = stampBadge(ctx, banner, banner.stamp);
  return groupXml(ctx.next(), namedAs('node', text, banner.id), banner, main + stamp);
};
