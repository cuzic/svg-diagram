import {defineRaciPart} from '../raci.ts';
import {raci} from '../../bands/table.ts';

export const raciPart = /* @__PURE__ */ defineRaciPart<ReturnType<typeof raci>>(raci);
