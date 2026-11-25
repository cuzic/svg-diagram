import {defineFmeaPart} from '../fmea.ts';
import {fmea} from '../../bands/table.ts';

export const fmeaPart = /* @__PURE__ */ defineFmeaPart<ReturnType<typeof fmea>>(fmea);
