import { funnelBand } from '../flow-funnel.js';
import { withHandle } from './shared.js';
/** A narrowing stack of funnel stages. `scale: 'value'` uses each stage value; `showRate` prints conversion from the preceding stage. */
export function funnel(stages, opts) { return withHandle(funnelBand(stages, opts), opts?.id); }
