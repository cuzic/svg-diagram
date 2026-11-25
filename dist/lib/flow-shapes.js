import { placeFlowShape } from './flow-layout-core.js';
import { chevronTexts, layoutChevron } from './flow-chevron.js';
import { funnelTexts, layoutFunnel } from './flow-funnel.js';
import { cycleTexts, layoutCycleShape } from './flow-cycle.js';
import { vennTexts, layoutVenn } from './flow-venn.js';
import { concentricTexts, layoutConcentricShape } from './flow-concentric.js';
import { emblemTexts, layoutEmblem } from './flow-emblem.js';
import { valueChainTexts, layoutValueChain } from './flow-value-chain.js';
export { placeFlowShape } from './flow-layout-core.js';
export { chevronBand, chevronTexts, layoutChevron } from './flow-chevron.js';
export { funnelBand, funnelTexts, layoutFunnel } from './flow-funnel.js';
export { cycleBand, cycleTexts, layoutCycleShape } from './flow-cycle.js';
export { vennBand, vennTexts, layoutVenn } from './flow-venn.js';
export { concentricBand, concentricTexts, layoutConcentricShape } from './flow-concentric.js';
export { emblemBand, emblemTexts, layoutEmblem } from './flow-emblem.js';
export { valueChainBand, valueChainTexts, layoutValueChain } from './flow-value-chain.js';
export const flowShapeIds = (b) => (b.type === 'valueChain' ? [...b.support, ...b.primary] : b.type === 'funnel' ? b.stages : b.type === 'venn' ? b.sets : b.type === 'concentric' ? [...b.rings, ...b.sectors ?? [], ...b.marks ?? []] : b.type === 'emblem' ? b.items : b.steps).flatMap(x => x.id ? [x.id] : []);
export function flowShapeTexts(b, roles) {
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
export function layoutFlowShape(b, x, y, cw, widthOf, roles, mode) {
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
