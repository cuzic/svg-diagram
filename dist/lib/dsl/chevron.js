import { chevronBand } from '../flow-chevron.js';
import { withHandle } from './shared.js';
/** A row or column of arrow-shaped process steps. Step ids are anchors for connect() and spotlight. */
export function chevron(steps, opts) { return withHandle(chevronBand(steps, opts), opts?.id); }
