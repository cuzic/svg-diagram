import {defineTornadoPart} from '../tornado.ts';
import {tornado} from '../../bands/tornado.ts';

export const tornadoPart = /* @__PURE__ */ defineTornadoPart<ReturnType<typeof tornado>>(tornado);
