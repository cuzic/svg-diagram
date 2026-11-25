import {defineSankeyPart} from '../sankey.ts';
import {sankey} from '../../bands/sankey.ts';

export const sankeyPart = /* @__PURE__ */ defineSankeyPart<ReturnType<typeof sankey>>(sankey);
