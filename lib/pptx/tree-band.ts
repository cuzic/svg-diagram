import type {LaidOutOf} from '../band-table.ts';
import {register} from './adapter.ts';
import type {PptxAdapter} from './adapter.ts';
import {treeXml} from './tree.ts';

/** A tree as shapes (./tree.ts); a dimmed one stays a picture, as the muted look is not mapped yet. */
export const treePptx: PptxAdapter<LaidOutOf<'tree'>> = (band, ctx) => {
  if (band.dim) return undefined;
  const {xml, glue} = treeXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
  for (const g of glue) register(ctx, g.dslId, g.id, g.rect);
  return xml;
};
