import {register} from './adapter.ts';
import type {PptxAdapter} from './adapter.ts';
import {flowShapeXml} from './flow.ts';
import type {LaidOutFlowShape} from '../flow-shapes.ts';

/** A flow shape (chevron, funnel, cycle, Venn, concentric, emblem, value chain) as shapes (./flow.ts); a dimmed one stays a picture. */
export const flowPptx: PptxAdapter<LaidOutFlowShape> = (band, ctx) => {
  if (band.dim) return undefined;
  const {xml, glue} = flowShapeXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
  for (const g of glue) register(ctx, g.dslId, g.id, g.rect);
  return xml;
};

export {pyramidPptx} from './pyramid-band.ts';
export {timelinePptx} from './timeline-band.ts';
