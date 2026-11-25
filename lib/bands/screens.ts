import {stateMatrixFindings} from '../state-matrix-rules.ts';
import {placeScreenGrid, placeStateMatrix} from '../layout-wireframes.ts';
import {screensBuilder, screensDefinition, stateMatrixBuilder} from '../screens-definition.ts';
import {collectScreenGridTextRequests, collectStateMatrixTextRequests} from '../wireframe.ts';

export {stateRow} from '../dsl/state-matrix.ts';
export {wf} from '../wireframe.ts';

const screenDefinition = /* @__PURE__ */ screensDefinition(collectScreenGridTextRequests, placeScreenGrid);
const matrixDefinition = /* @__PURE__ */ screensDefinition(collectStateMatrixTextRequests, placeStateMatrix, stateMatrixFindings);
export const screens = /* @__PURE__ */ screensBuilder(screenDefinition);
export const stateMatrix = /* @__PURE__ */ stateMatrixBuilder(matrixDefinition);

/** @internal Definitions used by the full renderer. */
export const screenGridDefinition: ReturnType<typeof screensDefinition> = screenDefinition;
export const stateMatrixDefinition: ReturnType<typeof screensDefinition> = matrixDefinition;
