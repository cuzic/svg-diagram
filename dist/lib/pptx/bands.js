import { drawBandFallback } from './band-fallback.js';
import { bandPicture } from './image-band.js';
import { svgShapesXml } from './svg-shapes.js';
import { bannerPptx, boxPptx, captionPptx, gridPptx, groupPptx, rowPptx } from './box-bands.js';
import { tablePptx } from './table-band.js';
import { treePptx } from './tree-band.js';
import { quadrantPptx } from './quadrant-band.js';
import { statesPptx } from './states-band.js';
import { causePptx } from './cause-band.js';
import { legendPptx } from './legend-band.js';
import { flowPptx } from './flow-band.js';
import { pyramidPptx } from './pyramid-band.js';
import { timelinePptx } from './timeline-band.js';
/** One disposition per laid-out band type; a missing band type fails compilation. */
export const BAND_HANDLERS = {
    caption: captionPptx, box: boxPptx, banner: bannerPptx, group: groupPptx, row: rowPptx, grid: gridPptx, table: tablePptx,
    legend: legendPptx, swimlane: 'image', wireframe: 'image', screens: 'image', sequence: 'image', raw: 'image', pyramid: pyramidPptx,
    curve: 'image', plane: 'image', quadrant: quadrantPptx, wordart: 'image', chevron: flowPptx, funnel: flowPptx, cycle: flowPptx,
    venn: flowPptx, concentric: flowPptx, emblem: flowPptx, valueChain: flowPptx, bars: 'image', chart: 'image', image: 'image', people: 'image', dots: 'image', math: 'image',
    timeline: timelinePptx, tree: treePptx, states: statesPptx, cause: causePptx, cloud: 'image', gantt: 'image', classes: 'image', bpmn: 'image',
    fta: 'image', status: 'image', bowtie: 'image', comic: 'image',
};
export function bandXml(band, ctx, index) {
    // the one place the band type and its handler are correlated by hand (lib/emit.ts looks the band up by its definition instead)
    const handler = BAND_HANDLERS[band.type];
    return (handler === 'image' ? undefined : handler(band, ctx, index)) ?? drawBandFallback(band, ctx, index, () => bandPicture(ctx.ld, band, index), svgShapesXml);
}
