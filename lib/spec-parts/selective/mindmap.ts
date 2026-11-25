import {defineMindmapPart} from '../mindmap.ts';
import {mindmap} from '../../bands/tree.ts';

export const mindmapPart = /* @__PURE__ */ defineMindmapPart<ReturnType<typeof mindmap>>(mindmap);
