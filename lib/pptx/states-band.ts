import type {LaidOutOf} from '../band-table.ts';
import {register} from './adapter.ts';
import type {PptxAdapter} from './adapter.ts';
import {statesXml} from './states.ts';

/** A state diagram or flowchart as shapes (./states.ts); a dimmed one, or one with icons, stays a picture. */
export const statesPptx: PptxAdapter<LaidOutOf<'states'>> = (band, ctx) => {
  if (band.dim || band.icons.length) return undefined;
  const {xml, glue} = statesXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
  for (const g of glue) register(ctx, g.dslId, g.id, g.rect);
  return xml;
};
