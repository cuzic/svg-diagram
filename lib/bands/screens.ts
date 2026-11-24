import {placeScreens} from '../layout-wireframes.ts';
import {screensBuilder, screensDefinition, stateMatrixBuilder} from '../screens-definition.ts';
import {collectTextRequests} from '../wireframe.ts';

export {stateRow} from '../dsl/state-matrix.ts';
export {wf} from '../wireframe.ts';

const definition = /* @__PURE__ */ screensDefinition(collectTextRequests, placeScreens);
export const screens = /* @__PURE__ */ screensBuilder(definition);
export const stateMatrix = /* @__PURE__ */ stateMatrixBuilder(definition);
