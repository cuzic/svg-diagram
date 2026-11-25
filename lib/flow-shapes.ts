import type {FlowShapeBand, LaidOutFlowShape} from './flow-types.ts';
import type {FontFamily, Roles, WidthOf, WrapMode} from './types/core.ts';
import {placeFlowShape} from './flow-layout-core.ts';
import {chevronTexts, layoutChevron} from './flow-chevron.ts';
import {funnelTexts, layoutFunnel} from './flow-funnel.ts';
import {cycleTexts, layoutCycleShape} from './flow-cycle.ts';
import {vennTexts, layoutVenn} from './flow-venn.ts';
import {concentricTexts, layoutConcentricShape} from './flow-concentric.ts';
import {emblemTexts, layoutEmblem} from './flow-emblem.ts';
import {valueChainTexts, layoutValueChain} from './flow-value-chain.ts';

export type * from './flow-types.ts';
export {placeFlowShape} from './flow-layout-core.ts';
export type {FlowLayout} from './flow-layout-core.ts';
export {chevronBand, chevronTexts, layoutChevron} from './flow-chevron.ts';
export {funnelBand, funnelTexts, layoutFunnel} from './flow-funnel.ts';
export {cycleBand, cycleTexts, layoutCycleShape} from './flow-cycle.ts';
export {vennBand, vennTexts, layoutVenn} from './flow-venn.ts';
export {concentricBand, concentricTexts, layoutConcentricShape} from './flow-concentric.ts';
export {emblemBand, emblemTexts, layoutEmblem} from './flow-emblem.ts';
export {valueChainBand, valueChainTexts, layoutValueChain} from './flow-value-chain.ts';

export const flowShapeIds = (b: FlowShapeBand): string[] => (b.type === 'valueChain' ? [...b.support, ...b.primary] : b.type === 'funnel' ? b.stages : b.type === 'venn' ? b.sets : b.type === 'concentric' ? [...b.rings, ...b.sectors ?? [], ...b.marks ?? []] : b.type === 'emblem' ? b.items : b.steps).flatMap(x => x.id ? [x.id] : []);

export function flowShapeTexts(b: FlowShapeBand, roles: Roles): [string, number, number, FontFamily][] {
  switch (b.type) {
    case 'chevron': return chevronTexts(b, roles);
    case 'cycle': return cycleTexts(b, roles);
    case 'funnel': return funnelTexts(b, roles);
    case 'venn': return vennTexts(b, roles);
    case 'concentric': return concentricTexts(b, roles);
    case 'emblem': return emblemTexts(b, roles);
    case 'valueChain': return valueChainTexts(b, roles);
  }
}

export function layoutFlowShape(b: FlowShapeBand, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutFlowShape {
  switch (b.type) {
    case 'chevron': return placeFlowShape(b, x, y, cw, widthOf, roles, mode, layoutChevron);
    case 'funnel': return placeFlowShape(b, x, y, cw, widthOf, roles, mode, layoutFunnel);
    case 'cycle': return placeFlowShape(b, x, y, cw, widthOf, roles, mode, layoutCycleShape);
    case 'venn': return placeFlowShape(b, x, y, cw, widthOf, roles, mode, layoutVenn);
    case 'concentric': return placeFlowShape(b, x, y, cw, widthOf, roles, mode, layoutConcentricShape);
    case 'emblem': return placeFlowShape(b, x, y, cw, widthOf, roles, mode, layoutEmblem);
    case 'valueChain': return placeFlowShape(b, x, y, cw, widthOf, roles, mode, layoutValueChain);
  }
}
