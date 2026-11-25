import { stateMatrixFindings } from '../state-matrix-rules.js';
import { placeScreenGrid, placeStateMatrix } from '../layout-wireframes.js';
import { screensBuilder, screensDefinition, stateMatrixBuilder } from '../screens-definition.js';
import { collectScreenGridTextRequests, collectStateMatrixTextRequests } from '../wireframe.js';
export { stateRow } from '../dsl/state-matrix.js';
export { wf } from '../wireframe.js';
const screenDefinition = /* @__PURE__ */ screensDefinition(collectScreenGridTextRequests, placeScreenGrid);
const matrixDefinition = /* @__PURE__ */ screensDefinition(collectStateMatrixTextRequests, placeStateMatrix, stateMatrixFindings);
export const screens = /* @__PURE__ */ screensBuilder(screenDefinition);
export const stateMatrix = /* @__PURE__ */ stateMatrixBuilder(matrixDefinition);
/** @internal Definitions used by the full renderer. */
export const screenGridDefinition = screenDefinition;
export const stateMatrixDefinition = matrixDefinition;
