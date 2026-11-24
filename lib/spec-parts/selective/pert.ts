import {definePertPart} from '../pert.ts';
import {pert} from '../../bands/pert.ts';

export const pertPart = /* @__PURE__ */ definePertPart<ReturnType<typeof pert>>(pert);
