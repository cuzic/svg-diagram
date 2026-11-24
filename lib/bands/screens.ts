import {stateMatrixFindings} from '../state-matrix-rules.ts';
import {placeScreenGrid, placeStateMatrix} from '../layout-wireframes.ts';
import {screensBuilder, screensDefinition, stateMatrixBuilder} from '../screens-definition.ts';
import {collectTextRequests} from '../wireframe.ts';

export {stateRow} from '../dsl/state-matrix.ts';
export {wf} from '../wireframe.ts';

const screenDefinition = /* @__PURE__ */ screensDefinition(collectTextRequests, placeScreenGrid);
const matrixDefinition = /* @__PURE__ */ screensDefinition(collectTextRequests, placeStateMatrix, stateMatrixFindings);
export const screens = /* @__PURE__ */ screensBuilder(screenDefinition);
export const stateMatrix = /* @__PURE__ */ stateMatrixBuilder(matrixDefinition);
