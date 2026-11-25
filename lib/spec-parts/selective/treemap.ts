import {defineTreemapPart} from '../treemap.ts';
import {treemap} from '../../bands/treemap.ts';

export const treemapPart = /* @__PURE__ */ defineTreemapPart<ReturnType<typeof treemap>>(treemap);
