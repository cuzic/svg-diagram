import type {SelectedPart} from '../../spec-selective.ts';
import {box} from '../../bands/box.ts';
import {versus} from '../../compose/selective/versus.ts';
import {defineVersusPart} from '../versus.ts';

export const versusPart: SelectedPart = /* @__PURE__ */ defineVersusPart(versus, box);
