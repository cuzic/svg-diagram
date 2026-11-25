import type {LaidOutOf} from '../band-table.ts';
import {register} from './adapter.ts';
import type {PptxAdapter} from './adapter.ts';
import {quadrantXml} from './quadrant.ts';

/** A quadrant as shapes (./quadrant.ts); a dimmed one stays a picture. */
export const quadrantPptx: PptxAdapter<LaidOutOf<'quadrant'>> = (band, ctx) => {
  if (band.dim) return undefined;
  const {xml, glue} = quadrantXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
  for (const g of glue) register(ctx, g.dslId, g.id, g.rect);
  return xml;
};
