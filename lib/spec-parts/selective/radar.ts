import {defineRadarPart} from '../radar.ts';
import {radar} from '../../bands/radar.ts';

export const radarPart = /* @__PURE__ */ defineRadarPart<ReturnType<typeof radar>>(radar);
