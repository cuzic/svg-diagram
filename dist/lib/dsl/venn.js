import { vennBand } from '../flow-venn.js';
import { withHandle } from './shared.js';
/** A two- or three-set Venn diagram. Dashed outlines supplement translucent colours, so sets are not distinguished by colour alone. */
export function venn(sets, opts) { return withHandle(vennBand(sets, opts), opts?.id); }
