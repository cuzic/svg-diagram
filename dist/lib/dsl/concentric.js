import { concentricBand } from '../flow-concentric.js';
import { withHandle } from './shared.js';
export function concentric(rings, opts) { return withHandle(concentricBand(rings, opts), opts?.id); }
