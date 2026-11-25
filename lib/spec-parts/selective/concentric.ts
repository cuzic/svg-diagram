import {defineConcentricPart} from '../concentric.ts';
import {concentric} from '../../bands/concentric.ts';

export const concentricPart = /* @__PURE__ */ defineConcentricPart<ReturnType<typeof concentric>>(concentric);
