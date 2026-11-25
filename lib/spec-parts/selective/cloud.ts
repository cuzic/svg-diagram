import {defineCloudPart} from '../cloud.ts';
import {cloud} from '../../bands/cloud.ts';

export const cloudPart = /* @__PURE__ */ defineCloudPart<ReturnType<typeof cloud>>(cloud);
