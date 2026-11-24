import {placeScreens} from '../layout-wireframes.ts';
import {screensFor} from '../screens-definition.ts';
import {collectTextRequests} from '../wireframe.ts';

export {stateRow} from '../dsl/sequence-table-swimlane.ts';
export {wf} from '../wireframe.ts';

export const {screens, stateMatrix} = /* @__PURE__ */ screensFor(collectTextRequests, placeScreens);
