// Spec parts of round R2 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// Charts for analysis: flows (sankey), shares (treemap), a grid of values (heatmap), three measures at once (bubble), sensitivity
// (tornado) and a strategy canvas.
import {bubble, heatmap, sankey, strategyCanvas, tornado, treemap} from '../dsl-pure.ts';
import type {PartDef} from '../spec-kit.ts';
import {defineSankeyPart} from './sankey.ts';
import {defineTreemapPart} from './treemap.ts';
import {defineHeatmapPart} from './heatmap.ts';
import {defineBubblePart} from './bubble.ts';
import {defineTornadoPart} from './tornado.ts';
import {defineStrategyCanvasPart} from './strategy-canvas.ts';

export const PARTS_R2: readonly PartDef[] = [
  defineSankeyPart<ReturnType<typeof sankey>>(sankey),
  defineTreemapPart<ReturnType<typeof treemap>>(treemap),
  defineHeatmapPart<ReturnType<typeof heatmap>>(heatmap),
  defineBubblePart<ReturnType<typeof bubble>>(bubble),
  defineTornadoPart<ReturnType<typeof tornado>>(tornado),
  defineStrategyCanvasPart<ReturnType<typeof strategyCanvas>>(strategyCanvas),
];
