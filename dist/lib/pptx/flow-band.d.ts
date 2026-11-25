import type { PptxAdapter } from './adapter.ts';
import type { LaidOutFlowShape } from '../flow-shapes.ts';
/** A flow shape (chevron, funnel, cycle, Venn, concentric, emblem, value chain) as shapes (./flow.ts); a dimmed one stays a picture. */
export declare const flowPptx: PptxAdapter<LaidOutFlowShape>;
export { pyramidPptx } from './pyramid-band.ts';
export { timelinePptx } from './timeline-band.ts';
