import {defineSequencePart} from '../sequence.ts';
import {sequence} from '../../bands/sequence.ts';

export const sequencePart = /* @__PURE__ */ defineSequencePart<ReturnType<typeof sequence>>(sequence);
