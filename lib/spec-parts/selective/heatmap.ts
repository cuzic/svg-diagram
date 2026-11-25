import {defineHeatmapPart} from '../heatmap.ts';
import {heatmap} from '../../bands/heatmap.ts';

export const heatmapPart = /* @__PURE__ */ defineHeatmapPart<ReturnType<typeof heatmap>>(heatmap);
