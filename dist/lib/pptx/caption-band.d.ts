import type { LaidOutOf } from '../band-table.ts';
import type { BandXml } from './adapter.ts';
/** Text only: no frame, no padding (the svg writes it at band.x / band.y). Its `tone` colours the text, which the runs already carry, so it is not passed as the box's. */
export declare const captionPptx: BandXml<LaidOutOf<'caption'>>;
