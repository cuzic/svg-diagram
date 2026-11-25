// Spec parts of round R2 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// Charts for analysis: flows (sankey), shares (treemap), a grid of values (heatmap), three measures at once (bubble), sensitivity
// (tornado) and a strategy canvas.
import { bubble, heatmap, sankey, strategyCanvas, tornado, treemap } from '../dsl-pure.js';
import { defineSankeyPart } from './sankey.js';
import { defineTreemapPart } from './treemap.js';
import { defineHeatmapPart } from './heatmap.js';
import { defineBubblePart } from './bubble.js';
import { defineTornadoPart } from './tornado.js';
import { defineStrategyCanvasPart } from './strategy-canvas.js';
export const PARTS_R2 = [
    defineSankeyPart(sankey),
    defineTreemapPart(treemap),
    defineHeatmapPart(heatmap),
    defineBubblePart(bubble),
    defineTornadoPart(tornado),
    defineStrategyCanvasPart(strategyCanvas),
];
